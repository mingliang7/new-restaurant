Restaurant.Collection.EndOfProcess.before.insert((userId, doc) => {
  Restaurant.ReactiveState.Eop.set(doc._id, false); //set wait for client when eop request
  doc._id = idGenerator.gen(Restaurant.Collection.EndOfProcess, 6);
  let tmpStartDate = moment(doc.startEopDate);
  let tmpEndDate = moment(doc.endEopDate).add('1', 'days');
  let startDate = moment(tmpStartDate).toDate();
  let endDate = moment(tmpEndDate).toDate();
  findClosedSale(doc._id, startDate, endDate);
});


let findClosedSale = (id, startDate, endDate) => {
  let saleObj = {};
  let sales = Restaurant.Collection.Sales.find({
    saleDate: {
      $gte: startDate,
      $lt: endDate
    },
    'eop.status': false,
    $or: [{
      status: 'closed'
    }, {
      status: 'partial'
    }]
  });
  if (sales.count() > 0) {
    sales.forEach((sale) => {
      let date = moment(sale.saleDate).format('YYYY-MM-DD');
      if (_.isUndefined(saleObj[date])) {
        saleObj[date] = extractNewProduct(sale._id, {});
      } else {
        saleObj[date] = extractNewProduct(sale._id, saleObj[date]);
      }
    });
    Meteor.defer(() => { //update active stock by sale
      reduceStock(id, saleObj, startDate, endDate);
      reduceActiveStock(id, startDate, endDate);
    });
  } else {
    reduceActiveStock(id, startDate, endDate);
    // Restaurant.Collection.EndOfProcess.remove(id);
  }

};


let extractNewProduct = (saleId, productObj) => {
  let product = productObj;
  let saleDetails = Restaurant.Collection.SaleDetails.find({
    saleId: saleId
  });
  saleDetails.forEach((saleDetail) => {
    saleDetail._product.ingradient.forEach((ingradient) => {
      if (_.isUndefined(product[ingradient.productId])) {
        product[ingradient.productId] = {
          qty: ingradient.qty * saleDetail.quantity,
          saleId: [saleId]
        };
      } else {
        product[ingradient.productId].qty += ingradient.qty * saleDetail.quantity;
        product[ingradient.productId].saleId.push(saleId);
      }
    });
  });
  return product;
};


let reduceStock = (eopId, saleObj, startDate, endDate) => {
  for (let k in saleObj) { //extract obj by day
    for (let j in saleObj[k]) { //extrach productId, and quantity
      let stockIn = Restaurant.Collection.StockIn.findOne({
        materialId: j,
        status: 'active',
        stockInDate: {
          $gte: startDate,
          $lt: endDate
        }
      });
      let tmpQty = 0;
      let material = Restaurant.Collection.Materials.findOne(j);
      if (stockIn) {
        tmpQty = stockIn.qty - saleObj[k][j].qty; //minus qty from stock in
        if (material._outstandingAmount && material._outstandingAmount.length > 0) { //check if material is exist or empty
          let lastOs = material._outstandingAmount.last(); //find outstanding amout obj from _outstandingAmount
          tmpQty += lastOs.qty;
        }
        Restaurant.Collection.StockIn.direct.update(stockIn._id, {
          $set: {
            status: 'closed',
            eopId: eopId
          }
        }); //update stockin to close after reduce stock and set end of process Id
      } else {
        if (material._outstandingAmount && material._outstandingAmount.length > 0) {
          let lastOs = material._outstandingAmount.last();
          tmpQty = lastOs.qty - saleObj[k][j].qty;
        } else {
          tmpQty = tmpQty - saleObj[k][j].qty;
        }
      }
      let selector = {};
      if (_.isUndefined(stockIn)) {
        selector.$push = {
          _outstandingAmount: {
            reduceStockId: '',
            eopId: eopId,
            reduceStockDate: startDate,
            qty: tmpQty
          }
        };
      } else {
        selector.$push = {
          _outstandingAmount: {
            reduceStockId: stockIn._id,
            eopId: eopId,
            reduceStockDate: startDate,
            qty: tmpQty
          }
        };
      }
      console.log(selector);
      updateMaterial(j, selector);
      for (let i = 0; i < saleObj[k][j].saleId.length; i++) {
        Restaurant.Collection.Sales.direct.update({
          _id: saleObj[k][j].saleId[i]
        }, {
          $set: {
            eop: {
              status: true,
              _id: eopId
            }
          }
        });
      }
    }
  }
};


let reduceActiveStock = (eopId, startDate, endDate) => {
  let stockIns = Restaurant.Collection.StockIn.find({
    status: 'active'
  });
  console.log(stockIns.count());
  if (stockIns.count() > 0) {
    stockIns.forEach((stockIn) => {
      let selector = {};
      let tmpQty = 0;
      let material = Restaurant.Collection.Materials.findOne(stockIn.materialId);
      if (material._outstandingAmount && material._outstandingAmount.length > 0) {
        let lastOs = material._outstandingAmount.last();
        tmpQty = lastOs.qty + stockIn.qty;
      } else {
        tmpQty = tmpQty + stockIn.qty;
      }
      selector.$push = {
        _outstandingAmount: {
          reduceStockId: stockIn._id,
          eopId: eopId,
          reduceStockDate: startDate,
          qty: tmpQty
        }
      };
      console.log(selector);
      Restaurant.Collection.StockIn.update(stockIn._id, {
        $set: {
          status: 'closed',
          eopId: eopId
        }
      });
      updateMaterial(stockIn.materialId, selector);
    });
  }
};


let updateMaterial = (id, selector) => {
  Restaurant.Collection.Materials.update(id, selector);
};


//after remove

Restaurant.Collection.EndOfProcess.before.remove((userId, doc) => {
  updateStockInStatus(doc._id);
  updateMaterialOsAmount(doc._id);
  updateSaleEopStatus(doc._id);
});

let updateStockInStatus = (eopId) => {
  Restaurant.Collection.StockIn.update({
    eopId: eopId
  }, {
    $set: {
      status: 'active'
    },
    $unset: {
      eopId: ''
    }
  }, {
    multi: true
  });
};

let updateMaterialOsAmount = (eopId) => {
  Restaurant.Collection.Materials.update({
    _outstandingAmount: {
      $elemMatch: {
        eopId: eopId
      }
    }
  }, {
    $pull: {
      _outstandingAmount: {
        eopId: eopId
      }
    }
  }, {multi: true});
};

let updateSaleEopStatus = (eopId) => {
  Restaurant.Collection.Sales.direct.update({
    'eop._id': eopId
  }, {
    $set: {
      'eop.status': false
    },
    $unset: {
      'eop._id': ''
    }
  },{multi: true});
};
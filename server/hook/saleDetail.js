Restaurant.Collection.SaleDetails.before.insert((userId,doc)=>{
    if(!doc.quantityOut){
      doc.quantityOut = 0;
    }
})
Restaurant.Collection.SaleDetails.after.insert((userId, doc) => {
  Meteor.defer(() => {
    Sale.sumSaleDetail(doc.saleId); //sum sale details
  })
});

Restaurant.Collection.SaleDetails.after.update(function(userId, doc) {
  Meteor.defer(() => {
    Sale.sumSaleDetail(doc.saleId); //sum sale details
  })
});

Restaurant.Collection.SaleDetails.after.remove((userId, doc) => {
  Meteor.defer(() => {
    Sale.sumSaleDetail(doc.saleId);
  });
});

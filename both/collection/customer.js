Restaurant.Collection.Customers = new Mongo.Collection("restaurant_customers");
Restaurant.Schema.Customers = new SimpleSchema({
    name: {
        type: String,
        label: "ឈ្មោះ",
        unique: true,
        max: 200
    },
    gender: {
        type: String,
        label: "ភេទ",
        autoform: {
            type: "select",
            options: function () {
                return Restaurant.List.gender();
            }
        }
    },
    phone: {
        type: String,
        label: "លេខទូរស័ព្ទ",
        optional:true
    },
    address: {
        type: String,
        label: "អាសយដ្ឋាន",
        autoform: {
            afFieldInput: {
                type: "textarea"
            }
        },
        optional:true
    }
});
Restaurant.Collection.Customers.attachSchema(Restaurant.Schema.Customers);

Template._editProfile.helpers({
    userId(){
        return this.id;
    }
});
AutoForm.hooks({
    editProfile: {
        onSubmit: function (doc) {
            this.event.preventDefault();
            if(doc.newPassword == doc.confirmPassword) {
                Meteor.call('editProfile', doc.userId, doc.newPassword, function (er, re) {
                    if (er) {
                        Bert.alert(er.message, 'danger', 'growl-top-right');
                    } else {
                        Bert.alert('កែប្រែបានជោគជ័យ', 'success', 'growl-top-right', 'fa-check');
                        IonModal.close();
                    }
                });
            }else{
                Bert.alert('លេខសំងាត់មិនដូចគ្នា', 'danger', 'growl-top-right', 'fa-check');
            }
            this.done();
        }
    }
});

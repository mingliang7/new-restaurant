Meteor.methods({
    editProfile(userId, newPassword){
        return Accounts.setPassword(userId, newPassword);
    }
});
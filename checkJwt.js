const User = require('./models/userModel');

const checkJwt = async (req, res, next) => {

    try {
        let authUserList = await User.get_authenticated_user_list()
        if(authUserList.find(x => x.id === req.body.current_user_uid)){
            next()
        }
        else{
            return res.status(200).json({ operation: "failed", message: "This User is not authenticated" });
        }        
    } catch (error) {
        console.error(error);
        res.status(500).json({ operation: "failed", message: 'Authentication Error' });
    }
}

module.exports = checkJwt
const User = require('./models/userModel');

const checkJwt = (pages) => {
    return async (req, res, next) => {
        try {
            let auth_access = (await User.get(req.body.current_user_uid)).auth_access

            if (pages.find(p => auth_access[p] === true)) {
                next()
            }
            else {
                return res.status(200).json({ operation: "failed", message: "This User does not have authentication for this api" });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Authentication Error' });
        }
    }
}

module.exports = checkJwt
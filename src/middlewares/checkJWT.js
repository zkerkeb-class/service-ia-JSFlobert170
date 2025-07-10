const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
    let token = req.headers.authorization;

    if (!token) {
        return next({ message: "Missing token" });
    }
    const jwtToken = token.split(" ")[1];
    jwt.verify(jwtToken, process.env.JWT_SECRET, function (error, jwtDecoded) {
        if (error) {
            return next(error);
        }
        req.userToken = jwtDecoded;
        next();
    });
}

module.exports = verifyToken;
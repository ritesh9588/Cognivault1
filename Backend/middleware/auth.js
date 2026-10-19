import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_jwt_secret_key_12345");
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token." });
    }
};

export default auth;

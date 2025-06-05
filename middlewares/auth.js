// import jwt from "jsonwebtoken";
// import prisma from "../database/db.config.js";
// const isAuthenticated = async (req, res, next) => {
//   try {
//     const token = req.cookies.token;

//     if (!token) {
//       return res.status(401).json({
//         message: "User not authenticated",
//         success: false,
//       });
//     }

//     const decode = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await prisma.user.findUnique({ where: { id: decode.id } });
//     if (!user) {
//       return res
//         .status(401)
//         .json({ success: false, message: "User not found" });
//     }

//     if (!decode) {
//       return res.status(401).json({
//         message: "Invalid token",
//         success: false,
//       });
//     }

//     req.id = decode.id;
//    req.user = await prisma.user.findUnique({ where: { id: decode.id } });;
//     next();
//   } catch (error) {
//     console.log("JWT verification failed:", error.message);

//     return res.status(401).json({
//       message: "Invalid or expired token",
//       success: false,
//     });
//   }
// };

// export default isAuthenticated;

import jwt from 'jsonwebtoken';
import prisma from '../database/db.config.js';
import ErrorHandler from '../middlewares/error.js';
import { refreshAccessToken } from '../controllers/userController.js';
import { catchAsyncError } from './catchAsyncError.js';

export const isAuthenticated = catchAsyncError(async (req, res, next) => {
	const token = req.cookies.token;

	if (!token) {
		return next(new ErrorHandler('User is not authenticated.', 401));
	}

	try {
		console.log('Received Token:', req.cookies.token);
		console.log('Decoding Token...');
		const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
		console.log('Decoded:', decoded);
		req.user = await prisma.user.findUnique({ where: { id: decoded.id } });

		if (!req.user) {
			return next(new ErrorHandler('User not found.', 401));
		}

		next();
	} catch (error) {
		if (error.name === 'TokenExpiredError') {
			// Automatically refresh the access token when expired
			return refreshAccessToken(req, res, next);
		}
		return next(new ErrorHandler('Invalid token.', 401));
	}
});

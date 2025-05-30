import prisma from '../database/db.config.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateToken } from '../utils/sendToken.js';
import { sendEmail } from '../utils/sendEmail.js';
import ErrorHandler from '../middlewares/error.js';
import { catchAsyncError } from '../middlewares/catchAsyncError.js';

export const register = catchAsyncError(async (req, res, next) => {
	try {
		const { username, email, password } = req.body;

		if (!username || !email || !password) {
			return next(new ErrorHandler('All fields are required.', 400));
		}

		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			return next(new ErrorHandler('Email already exists.', 400));
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const verificationToken = crypto.randomBytes(32).toString('hex');

		// Removed 'user' variable as it's not used after creation
		await prisma.user.create({
			data: {
				username,
				email,
				password: hashedPassword,
				verificationToken,
				isActive: false, // User is inactive until verified
			},
		});

		// Send verification email with link
		const verificationUrl = `${process.env.FRONTEND_URL}/verify-account?token=${verificationToken}`;
		sendEmail({
			email,
			subject: 'Activate Your Account',
			message: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #0f172a;">Welcome to <span style="color: #0284c7;">SocioFeed</span> 👋</h2>
      <p style="font-size: 16px; color: #334155;">Thank you for signing up! Please confirm your email address to activate your account and start using all the features.</p>
      <div style="margin: 20px 0;">
        <a href="${verificationUrl}" style="background-color: #0284c7; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Verify My Account
        </a>
      </div>
      <p style="font-size: 14px; color: #64748b;">If the button above doesn’t work, copy and paste this link into your browser:</p>
      <p style="font-size: 13px; word-break: break-all; color: #334155;">${verificationUrl}</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 12px; color: #94a3b8;">If you didn’t request this email, you can safely ignore it.</p>
    </div>
    `,
		});

		return res.status(201).json({
			success: true,
			message: 'Account created. Check your email for the verification link.',
		});
	} catch (error) {
		next(error);
	}
});

export const verifyAccount = catchAsyncError(async (req, res, next) => {
	const { token } = req.params;

	if (!token) {
		return next(new ErrorHandler('Invalid activation link.', 400));
	}

	// Removed 'result' variable as it's not used after the transaction
	await prisma.$transaction(async (prisma) => {
		const user = await prisma.user.findFirst({
			where: { verificationToken: token },
		});

		if (!user) {
			throw new ErrorHandler('Invalid or expired activation link.', 400);
		}

		await prisma.user.update({
			where: { id: user.id },
			data: { isActive: true, verificationToken: null },
		});
	});

	res.status(200).json({
		success: true,
		message: 'Account verified successfully.',
	});
});

export const login = catchAsyncError(async (req, res, _next) => {
	// Changed 'next' to '_next' here
	const { email, password } = req.body;

	const user = await prisma.user.findUnique({ where: { email } });
	if (!user || !user.isActive)
		return _next(new ErrorHandler('User not found or not verified.', 400)); // Also here

	const isMatch = await bcrypt.compare(password, user.password);
	if (!isMatch) return _next(new ErrorHandler('Invalid credentials.', 400)); // Also here

	generateToken(res, user, 'Login successful.');
});

export const logout = catchAsyncError(async (_, res, _next) => {
	// Changed 'next' to '_next' here
	res
		.clearCookie('token')
		.status(200)
		.json({ success: true, message: 'Logged out successfully.' });
});

export const getUser = catchAsyncError(async (req, res, _next) => {
	// Changed 'next' to '_next' here
	const user = req.user;
	res.status(200).json({
		success: true,
		user,
	});
});

export const forgotPassword = catchAsyncError(async (req, res, _next) => {
	// Changed 'next' to '_next' here
	const user = await prisma.user.findUnique({
		where: { email: req.body.email },
	});

	if (!user) return _next(new ErrorHandler('User not found.', 404)); // Also here

	const resetToken = crypto.randomBytes(32).toString('hex');
	await prisma.user.update({
		where: { email: user.email },
		data: {
			resetOtp: resetToken,
			resetExpires: new Date(Date.now() + 15 * 60 * 1000),
		},
	});
	const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
	const emailMessage = `<p>Hello,</p>
<p>We received a request to reset the password for your SocioFeed account associated with this email address.</p>
<p><a href="${resetLink}" style="display: inline-block; padding: 12px 25px; background-color: #8b5cf6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password Now</a></p>
<p>This link is valid for **15 minutes**. If the link expires, you can request a new one.</p>
<p>If you did not request this password reset, please disregard this email. Your account security is our top priority.</p>
<p>If you have any questions or need further assistance, please contact our support team.</p>
<p>Best regards,</p>
<p>The SocioFeed Team</p>`;

	sendEmail({
		email: user.email,
		subject: 'Action Required: Reset Your Password for SocioFeed Account',
		message: emailMessage,
	});

	res
		.status(200)
		.json({ success: true, message: 'Reset token sent via email.' });
});

export const resetPassword = catchAsyncError(async (req, res, _next) => {
	// Changed 'next' to '_next' here
	const { token, password, confirmPassword } = req.body;

	if (password !== confirmPassword)
		return _next(new ErrorHandler('Passwords do not match.', 400)); // Also here

	const user = await prisma.user.findFirst({
		where: { resetOtp: token, resetExpires: { gt: new Date() } },
	});

	if (!user)
		return _next(new ErrorHandler('Invalid or expired reset token.', 400)); // Also here

	const hashedPassword = await bcrypt.hash(password, 10);

	await prisma.user.update({
		where: { id: user.id },
		data: { password: hashedPassword, resetOtp: null, resetExpires: null },
	});

	res
		.status(200)
		.json({ success: true, message: 'Password reset successfully.' });
});

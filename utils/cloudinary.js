import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure cloudinary
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload file to cloudinary
export const uploadToCloudinary = async (filePath, folder = 'uploads') => {
	try {
		const result = await cloudinary.uploader.upload(filePath, {
			folder: folder,
			resource_type: 'auto',
			transformation: [
				{ width: 1000, height: 1000, crop: 'fill', gravity: 'face' },
				{ quality: 90 },
				{format: "webp"},
			],
		});
		return result;
	} catch (error) {
		console.error('Cloudinary upload error:', error);
		throw new Error('Failed to upload image');
	}
};

// Delete file from cloudinary
export const deleteFromCloudinary = async (
	publicId,
	resourceType = 'image'
) => {
	try {
		const result = await cloudinary.uploader.destroy(publicId, {
			resource_type: resourceType,
		});
		return result;
	} catch (error) {
		console.error('Cloudinary delete error:', error);
		throw new Error('Failed to delete image');
	}
};

export const uploadMultipleToCloudinary = async (
	filePaths,
	folder = 'uploads'
) => {
	try {
		const uploadPromises = filePaths.map((filePath) =>
			uploadToCloudinary(filePath, folder)
		);
		const results = await Promise.all(uploadPromises);

		// Clean up temp files
		filePaths.forEach((filePath) => {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		});

		return results;
	} catch (error) {
		// Clean up temp files on error
		filePaths.forEach((filePath) => {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		});
		throw error;
	}
};

export default cloudinary;

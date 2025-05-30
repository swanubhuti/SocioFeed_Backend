import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient({
	log: ['query'],
});

export default prisma;

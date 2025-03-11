import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdmin() {
  try {
    console.log('Initializing storage...');
    await storage.initialize();

    console.log('Creating admin user...');
    const hashedPassword = await hashPassword('admin');
    
    const adminUser = await storage.createUser({
      username: 'admin',
      password: hashedPassword,
      role: 'admin'
    });

    console.log('Admin user created successfully:', {
      ...adminUser,
      password: '[HIDDEN]'
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdmin();

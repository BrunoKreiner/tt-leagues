const database = require('./src/models/database');
const bcrypt = require('bcrypt');

async function testDatabase() {
    try {
        await database.connect();
        
        // Check if admin user exists
        const admin = await database.get('SELECT * FROM users WHERE username = ?', ['admin']);
        console.log('Admin user:', admin);
        
        if (admin) {
            // Test password verification
            const isValid = await bcrypt.compare('admin123', admin.password_hash);
            console.log('Password verification:', isValid);
        }
        
        // List all users
        const users = await database.all('SELECT id, username, first_name, last_name, is_admin FROM users');
        console.log('All users:', users);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await database.close();
    }
}

testDatabase();


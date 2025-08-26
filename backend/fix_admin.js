const database = require('./src/models/database');
const bcrypt = require('bcryptjs');

async function fixAdminPassword() {
    try {
        await database.connect();
        
        // Hash the correct password
        const hashedPassword = await bcrypt.hash('admin123', 10);
        console.log('New hash:', hashedPassword);
        
        // Update admin user password
        await database.run(
            'UPDATE users SET password_hash = ? WHERE username = ?',
            [hashedPassword, 'admin']
        );
        
        console.log('Admin password updated successfully');
        
        // Verify the update
        const admin = await database.get('SELECT * FROM users WHERE username = ?', ['admin']);
        const isValid = await bcrypt.compare('admin123', admin.password_hash);
        console.log('Password verification after update:', isValid);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await database.close();
    }
}

fixAdminPassword();


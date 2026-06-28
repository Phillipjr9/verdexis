class ConsoleOTP {
  constructor() {
    this.otpStorage = new Map();
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  storeOTP(key, otp) {
    const expiry = Date.now() + (5 * 60 * 1000);
    this.otpStorage.set(key, { otp, expiry });
    
    // Display OTP in console for testing
    console.log(`\n🔐 OTP for ${key}: ${otp}`);
    console.log(`⏰ Valid until: ${new Date(expiry).toLocaleTimeString()}\n`);
    
    setTimeout(() => {
      this.otpStorage.delete(key);
    }, 5 * 60 * 1000);
  }

  verifyOTP(key, providedOTP) {
    const stored = this.otpStorage.get(key);
    if (!stored) return { valid: false, error: 'OTP expired or not found' };
    
    if (Date.now() > stored.expiry) {
      this.otpStorage.delete(key);
      return { valid: false, error: 'OTP expired' };
    }
    
    if (stored.otp !== providedOTP) {
      return { valid: false, error: 'Invalid OTP code' };
    }
    
    this.otpStorage.delete(key);
    return { valid: true };
  }

  // Register user
  async registerUser(email, phoneNumber, password, name) {
    console.log(`\n📝 Registering user: ${name} (${email})`);
    
    const otp = this.generateOTP();
    const otpKey = `register_${email}`;
    this.storeOTP(otpKey, otp);

    return {
      success: true,
      message: 'Check console for OTP code',
      otpKey: otpKey
    };
  }

  // Verify registration
  async verifyRegistration(email, otp) {
    const otpKey = `register_${email}`;
    const verification = this.verifyOTP(otpKey, otp);
    
    if (verification.valid) {
      console.log(`✅ Registration verified for: ${email}`);
      return { success: true, message: 'Registration verified!' };
    } else {
      return { success: false, error: verification.error };
    }
  }

  // Send login OTP
  async sendLoginOTP(email) {
    console.log(`\n🔑 Login attempt for: ${email}`);
    
    const otp = this.generateOTP();
    const otpKey = `login_${email}`;
    this.storeOTP(otpKey, otp);

    return {
      success: true,
      message: 'Check console for login OTP',
      session: otpKey
    };
  }

  // Verify login
  async verifyLogin(session, otp) {
    const verification = this.verifyOTP(session, otp);
    
    if (verification.valid) {
      console.log(`✅ Login successful!`);
      return { success: true, message: 'Login successful!' };
    } else {
      return { success: false, error: verification.error };
    }
  }
}

module.exports = ConsoleOTP;
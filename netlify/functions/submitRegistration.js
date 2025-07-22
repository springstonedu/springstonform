// Import required libraries
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

// Configure Nodemailer for Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

exports.handler = async (event) => {
  // 1. Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 2. Parse and validate form data
    const data = JSON.parse(event.body);
    
    // Required field validation
    const requiredFields = ['parentName', 'email', 'phone', 'childName', 'academicPath'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          missingFields: missingFields
        })
      };
    }

    // 3. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email format' })
      };
    }

    // 4. Prepare document data
    const registrationData = {
      parentName: data.parentName,
      email: data.email,
      phone: data.phone,
      childName: data.childName,
      academicPath: data.academicPath,
      message: data.message || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: event.headers['client-ip'] || 'unknown'
    };

    // 5. Save to Firestore
    const docRef = await db.collection('registrations').add(registrationData);

    // 6. Send email notification
    await transporter.sendMail({
      from: `"School Admissions" <${process.env.GMAIL_EMAIL}>`,
      to: process.env.NOTIFICATION_EMAIL,
      subject: `New Registration: ${data.childName}`,
      html: `
        <h2 style="color: #144c93;">New Pre-Registration Received</h2>
        <p><strong>Parent Name:</strong> ${data.parentName}</p>
        <p><strong>Child Name:</strong> ${data.childName}</p>
        <p><strong>Program:</strong> ${data.academicPath.toUpperCase()}</p>
        <p><strong>Contact:</strong> ${data.email} | ${data.phone}</p>
        ${data.message ? `<p><strong>Message:</strong><br>${data.message}</p>` : ''}
        <hr>
        <p><small>Submitted at: ${new Date().toLocaleString()} | IP: ${registrationData.ipAddress}</small></p>
        <p><a href="https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore/data/~2Fregistrations~2F${docRef.id}">View in Firebase Console</a></p>
      `
    });

    // 7. Success response
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        documentId: docRef.id 
      })
    };

  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        details: error.message 
      })
    };
  }
};

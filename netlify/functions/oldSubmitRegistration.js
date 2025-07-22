// Import Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin with environment variables
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') // Fixes newline formatting
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

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
      message: data.message || '', // Optional field
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: event.headers['client-ip'] || 'unknown' // For basic analytics
    };

    // 5. Save to Firestore
    const docRef = await db.collection('registrations').add(registrationData);

    // 6. Success response
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        documentId: docRef.id 
      })
    };

  } catch (error) {
    // 7. Error handling
    console.error('Firestore Error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        details: error.message 
      })
    };
  }
};

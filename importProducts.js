const admin = require('firebase-admin');
const productsData = require('./products.json');

// Initialize Firebase
const serviceAccount = require('./serviceAccountKey.json'); // Download from Firebase Console
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://floyds-489c8-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

async function importProducts() {
  const batch = db.batch();
  const productsRef = db.collection('products');
  
  console.log(`Importing ${productsData.products.length} products...`);
  
  productsData.products.forEach((product) => {
    const price = parseFloat(product.price.replace('$', ''));
    const docRef = productsRef.doc(product.id.toString());
    
    batch.set(docRef, {
      name: product.name,
      price: price,
      description: product.description,
      image: product.image,
      category: product.category,
      featured: product.featured,
      stock: product.stock,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  console.log('Products imported successfully!');
  process.exit(0);
}

importProducts().catch((error) => {
  console.error('Error importing products:', error);
  process.exit(1);
});
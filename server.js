const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Middleware per abilitare CORS e gestire i dati JSON
app.use(cors());
app.use(express.json());

const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');
const CARTS_DIR = path.join(__dirname, 'carts');

// **ATTENZIONE:** Questo codice per la gestione dei file locali non funzionerà su Vercel.
// Dovrai sostituirlo con un database (es. MongoDB) per rendere il sito funzionante.
// Lo mantengo solo per completezza, ma su Vercel non salverà i dati.
if (!fs.existsSync(CARTS_DIR)) {
    fs.mkdirSync(CARTS_DIR);
}
if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify({
        'manga': [{ id: 101, title: 'Jujutsu Kaisen Vol. 1', description: '...', price: '12,90€', mainImageUrl: 'https://placehold.co/400x600/e74c3c/ffffff?text=Jujutsu+Kaisen', additionalImages: [] }],
        'fumettiAmericani': [],
        'tcg': [],
        'giochiTavolo': [],
        'actionFigure': [],
        'funkoPop': [],
        'libri': []
    }, null, 2));
}
if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([], null, 2));
}

// Funzioni di utilità per leggere/scrivere dati da/su file
const readData = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Errore nella lettura del file ${filePath}:`, error);
        return null;
    }
};

const writeData = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Errore nella scrittura del file ${filePath}:`, error);
    }
};

// --- ROTTE API PRODOTTI ---
// Ottieni tutti i prodotti
app.get('/api/products/all', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    if (products) {
        res.json(products);
    } else {
        res.status(500).json({ error: 'Impossibile leggere i dati dei prodotti.' });
    }
});

// Ottieni un prodotto per ID
app.get('/api/products/:category/:id', (req, res) => {
    const { category, id } = req.params;
    const products = readData(PRODUCTS_FILE);
    if (!products || !products[category]) {
        return res.status(404).json({ error: 'Categoria o prodotto non trovato.' });
    }
    const product = products[category].find(p => p.id == id);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: 'Prodotto non trovato.' });
    }
});

// Aggiungi un nuovo prodotto
app.post('/api/products', (req, res) => {
    const { category, ...newProduct } = req.body;
    if (!category) {
        return res.status(400).json({ error: 'La categoria è obbligatoria.' });
    }
    const products = readData(PRODUCTS_FILE);
    if (products) {
        if (!products[category]) {
            products[category] = [];
        }
        products[category].push({ ...newProduct, id: Date.now() });
        writeData(PRODUCTS_FILE, products);
        res.status(201).json({ message: 'Prodotto aggiunto con successo.' });
    } else {
        res.status(500).json({ error: 'Impossibile aggiungere il prodotto.' });
    }
});

// Elimina un prodotto
app.delete('/api/products/:category/:id', (req, res) => {
    const { category, id } = req.params;
    const products = readData(PRODUCTS_FILE);
    if (products && products[category]) {
        const initialLength = products[category].length;
        products[category] = products[category].filter(p => p.id != id);
        if (products[category].length < initialLength) {
            writeData(PRODUCTS_FILE, products);
            res.status(200).json({ message: 'Prodotto eliminato con successo.' });
        } else {
            res.status(404).json({ error: 'Prodotto non trovato.' });
        }
    } else {
        res.status(404).json({ error: 'Categoria o prodotto non trovato.' });
    }
});

// --- ROTTE API PRENOTAZIONI ---
app.get('/api/bookings/available', (req, res) => {
    const bookings = readData(BOOKINGS_FILE);
    res.json(bookings || []);
});

app.post('/api/bookings/add', (req, res) => {
    const newBooking = req.body;
    const bookings = readData(BOOKINGS_FILE);
    if (bookings) {
        bookings.push(newBooking);
        writeData(BOOKINGS_FILE, bookings);
        res.status(201).json({ message: 'Prenotazione aggiunta con successo.' });
    } else {
        res.status(500).json({ error: 'Impossibile aggiungere la prenotazione.' });
    }
});

app.delete('/api/bookings/cancel/:tableId/:date/:time', (req, res) => {
    const { tableId, date, time } = req.params;
    const bookings = readData(BOOKINGS_FILE);
    if (!bookings) {
        return res.status(500).json({ error: 'Impossibile leggere le prenotazioni.' });
    }
    const initialLength = bookings.length;
    const updatedBookings = bookings.filter(
        b => !(b.tableId == tableId && b.date === date && b.time === time)
    );
    
    if (updatedBookings.length < initialLength) {
        writeData(BOOKINGS_FILE, updatedBookings);
        res.status(200).json({ message: 'Prenotazione cancellata con successo.' });
    } else {
        res.status(404).json({ error: 'Prenotazione non trovata.' });
    }
});

// --- ROTTE API CARRELLO ---
// Ottieni il carrello di un utente
app.get('/api/cart/:userId', (req, res) => {
    const cartFile = path.join(CARTS_DIR, `${req.params.userId}.json`);
    if (fs.existsSync(cartFile)) {
        res.json(readData(cartFile));
    } else {
        res.json({ items: [] });
    }
});

// Salva il carrello di un utente
app.post('/api/cart/:userId', (req, res) => {
    const cartFile = path.join(CARTS_DIR, `${req.params.userId}.json`);
    writeData(cartFile, req.body);
    res.status(200).json({ message: 'Carrello salvato con successo.' });
});

// Endpoint di checkout (svuota il carrello)
app.post('/api/cart/checkout/:userId', (req, res) => {
    const cartFile = path.join(CARTS_DIR, `${req.params.userId}.json`);
    writeData(cartFile, { items: [] });
    res.status(200).json({ message: 'Checkout completato, carrello svuotato.' });
});

// Esporta l'app Express
module.exports = app;

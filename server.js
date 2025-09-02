const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware per abilitare CORS e gestire i dati JSON
app.use(cors());
app.use(express.json());

const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');
const CARTS_DIR = path.join(__dirname, 'carts');

// Crea le cartelle e i file se non esistono
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
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([]));
}

// Funzioni per leggere e scrivere i file JSON
const readData = (file) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`Errore nella lettura del file ${file}:`, error);
        return null;
    }
};

const writeData = (file, data) => {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Errore nella scrittura del file ${file}:`, error);
    }
};

// --- ROTTE API PRODOTTI ---
// Ottieni tutti i prodotti
app.get('/api/products/all', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    if (!products) {
        return res.status(500).json({ error: 'Errore interno del server.' });
    }
    res.json(products);
});

// Ottieni un singolo prodotto per ID
app.get('/api/products/:id', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    if (!products) {
        return res.status(500).json({ error: 'Errore interno del server.' });
    }
    const productId = parseInt(req.params.id);
    const allProducts = Object.values(products).flat();
    const product = allProducts.find(p => p.id === productId);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: 'Prodotto non trovato.' });
    }
});

// --- ROTTE API ADMIN ---
// Aggiungi un nuovo prodotto
app.post('/api/admin/products', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    const newProduct = req.body;
    
    // Genera un ID basato sul timestamp per unicità
    newProduct.id = Date.now();
    
    if (!products[newProduct.category]) {
        products[newProduct.category] = [];
    }
    products[newProduct.category].push(newProduct);
    writeData(PRODUCTS_FILE, products);
    res.status(201).json(newProduct);
});

// Modifica un prodotto esistente
app.put('/api/admin/products/:id', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    const productId = parseInt(req.params.id);
    const updatedProduct = req.body;
    
    let found = false;
    for (const category in products) {
        const index = products[category].findIndex(p => p.id === productId);
        if (index !== -1) {
            // Se la categoria è cambiata, rimuoviamo il vecchio prodotto e lo aggiungiamo nella nuova categoria
            if (category !== updatedProduct.category) {
                products[category].splice(index, 1);
                if (!products[updatedProduct.category]) {
                    products[updatedProduct.category] = [];
                }
                products[updatedProduct.category].push(updatedProduct);
            } else {
                products[category][index] = updatedProduct;
            }
            found = true;
            break;
        }
    }
    
    if (found) {
        writeData(PRODUCTS_FILE, products);
        res.json(updatedProduct);
    } else {
        res.status(404).json({ error: 'Prodotto non trovato.' });
    }
});

// Elimina un prodotto
app.delete('/api/admin/products/:id', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    const productId = parseInt(req.params.id);
    
    let found = false;
    for (const category in products) {
        const initialLength = products[category].length;
        products[category] = products[category].filter(p => p.id !== productId);
        if (products[category].length < initialLength) {
            found = true;
            break;
        }
    }
    
    if (found) {
        writeData(PRODUCTS_FILE, products);
        res.status(204).send();
    } else {
        res.status(404).json({ error: 'Prodotto non trovato.' });
    }
});

// --- ROTTE API PRENOTAZIONI ---
app.get('/api/bookings', (req, res) => {
    let bookings = readData(BOOKINGS_FILE);
    if (!bookings) return res.status(500).json({ error: 'Errore interno del server.' });
    
    // Filtra le prenotazioni scadute
    const now = new Date();
    bookings = bookings.filter(b => {
        // Aggiungi un controllo per assicurarti che 'endTime' esista
        if (!b.endTime) return true; // Mantieni le vecchie prenotazioni senza orario di fine
        
        const [year, month, day] = b.date.split('-').map(Number);
        const [hour, minute] = b.endTime.split(':').map(Number);
        const bookingEndTime = new Date(year, month - 1, day, hour, minute);
        return bookingEndTime > now;
    });

    writeData(BOOKINGS_FILE, bookings); // Sovrascrivi il file senza le prenotazioni scadute
    res.json(bookings);
});

app.post('/api/bookings', (req, res) => {
    const bookings = readData(BOOKINGS_FILE);
    const newBooking = req.body;
    
    // Controlla se il tavolo è già prenotato per quella data e orario
    const isBooked = bookings.some(b => b.tableId === newBooking.tableId && b.date === newBooking.date && b.time === newBooking.time);
    if (isBooked) {
        return res.status(409).json({ error: 'Tavolo già prenotato per questo orario.' });
    }

    bookings.push(newBooking);
    writeData(BOOKINGS_FILE, bookings);
    res.status(201).json(newBooking);
});

app.delete('/api/bookings/:tableId/:date/:time', (req, res) => {
    const bookings = readData(BOOKINGS_FILE);
    const { tableId, date, time } = req.params;
    
    const initialLength = bookings.length;
    const updatedBookings = bookings.filter(b =>
        !(b.tableId == tableId && b.date === date && b.time === time)
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

// Servire il file HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'E-commerceManbaga.html'));
});

// Avvia il server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});
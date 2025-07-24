-- Création de la base de données DOCC ERP
CREATE DATABASE IF NOT EXISTS docc_erp;
USE docc_erp;

-- Table des utilisateurs
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role ENUM('admin', 'production', 'manager', 'user') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table des clients
CREATE TABLE clients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    postal_code VARCHAR(10),
    country VARCHAR(50) DEFAULT 'Sénégal',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table des produits PBA
CREATE TABLE pba_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    unit_price DECIMAL(10,2) DEFAULT 0.00,
    category ENUM('9AR', '12AR', '12B', '10B') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des matériaux (fer, ciment, etc.)
CREATE TABLE materials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    unit ENUM('kg', 't', 'g', 'sac', 'barre') NOT NULL,
    unit_price DECIMAL(10,2) DEFAULT 0.00,
    category ENUM('fer', 'ciment', 'etrier') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des armatures
CREATE TABLE armatures (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    pba_product_id INT,
    unit_price DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pba_product_id) REFERENCES pba_products(id)
);

-- Table des stocks PBA
CREATE TABLE pba_stock (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pba_product_id INT NOT NULL,
    initial_stock INT DEFAULT 0,
    current_stock INT DEFAULT 0,
    total_produced INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pba_product_id) REFERENCES pba_products(id),
    UNIQUE(pba_product_id)
);

-- Table des stocks d'armatures
CREATE TABLE armature_stock (
    id INT PRIMARY KEY AUTO_INCREMENT,
    armature_id INT NOT NULL,
    current_stock INT DEFAULT 0,
    total_entries INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (armature_id) REFERENCES armatures(id),
    UNIQUE(armature_id)
);

-- Table des stocks de matériaux
CREATE TABLE material_stock (
    id INT PRIMARY KEY AUTO_INCREMENT,
    material_id INT NOT NULL,
    current_stock DECIMAL(10,3) DEFAULT 0.000,
    unit ENUM('kg', 't', 'g', 'sac', 'barre') NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id),
    UNIQUE(material_id)
);

-- Table des rapports journaliers
CREATE TABLE daily_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    report_date DATE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    observations TEXT,
    status ENUM('draft', 'submitted', 'validated') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, report_date)
);

-- Table des productions PBA dans les rapports
CREATE TABLE report_pba_production (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    pba_product_id INT NOT NULL,
    quantity INT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (pba_product_id) REFERENCES pba_products(id)
);

-- Table des matériaux utilisés dans les rapports
CREATE TABLE report_material_usage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    material_id INT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit ENUM('kg', 't', 'g', 'sac', 'barre') NOT NULL,
    additional_info VARCHAR(255), -- Pour les infos comme "+ 7 barres"
    FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
);

-- Table des armatures façonnées dans les rapports
CREATE TABLE report_armature_production (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    armature_id INT NOT NULL,
    quantity INT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (armature_id) REFERENCES armatures(id)
);

-- Table du personnel dans les rapports
CREATE TABLE report_personnel (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    position ENUM('production', 'soudeur', 'ferrailleur', 'ouvrier', 'macon', 'manoeuvre') NOT NULL,
    quantity INT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE
);

-- Table des commandes
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    client_id INT NOT NULL,
    status ENUM('draft', 'confirmed', 'quoted', 'paid', 'invoiced', 'delivered', 'cancelled') DEFAULT 'draft',
    order_date DATE NOT NULL,
    delivery_date DATE,
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Table des lignes de commande
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    pba_product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (pba_product_id) REFERENCES pba_products(id)
);

-- Table des devis
CREATE TABLE quotes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    order_id INT NOT NULL,
    quote_date DATE NOT NULL,
    validity_date DATE NOT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'expired') DEFAULT 'pending',
    total_amount DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Table des factures
CREATE TABLE invoices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    order_id INT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
    total_amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0.00,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Table des paiements
CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method ENUM('cash', 'check', 'transfer', 'card') NOT NULL,
    reference VARCHAR(100),
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Table des mouvements de stock PBA
CREATE TABLE pba_stock_movements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pba_product_id INT NOT NULL,
    movement_type ENUM('production', 'delivery', 'adjustment', 'initial') NOT NULL,
    quantity INT NOT NULL,
    reference_type ENUM('report', 'order', 'manual') NOT NULL,
    reference_id INT,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pba_product_id) REFERENCES pba_products(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Insertion des données de base

-- Produits PBA
INSERT INTO pba_products (code, name, category) VALUES
('9AR150', 'Poteau 9AR150', '9AR'),
('9AR300', 'Poteau 9AR300', '9AR'),
('9AR400', 'Poteau 9AR400', '9AR'),
('9AR650', 'Poteau 9AR650', '9AR'),
('12AR400', 'Poteau 12AR400', '12AR'),
('12AR650', 'Poteau 12AR650', '12AR'),
('12B1000', 'Poteau 12B1000', '12B'),
('12B1250', 'Poteau 12B1250', '12B'),
('12B1600', 'Poteau 12B1600', '12B'),
('12B2000', 'Poteau 12B2000', '12B'),
('10B2000', 'Poteau 10B2000', '10B');

-- Matériaux
INSERT INTO materials (code, name, unit, category) VALUES
('FER6', 'Fer 6mm', 'kg', 'fer'),
('FER8', 'Fer 8mm', 'kg', 'fer'),
('FER10', 'Fer 10mm', 'kg', 'fer'),
('FER12', 'Fer 12mm', 'kg', 'fer'),
('FER14', 'Fer 14mm', 'kg', 'fer'),
('FER20', 'Fer 20mm', 'kg', 'fer'),
('ETRIER', 'Étriers façonnés', 'barre', 'etrier'),
('CIMENT', 'Sacs de ciment', 'sac', 'ciment');

-- Armatures (correspondant aux PBA)
INSERT INTO armatures (code, name, pba_product_id) VALUES
('ARM_9AR150', 'Armature 9AR150', 1),
('ARM_9AR300', 'Armature 9AR300', 2),
('ARM_9AR400', 'Armature 9AR400', 3),
('ARM_9AR650', 'Armature 9AR650', 4),
('ARM_12AR400', 'Armature 12AR400', 5),
('ARM_12AR650', 'Armature 12AR650', 6),
('ARM_12B1000', 'Armature 12B1000', 7),
('ARM_12B1250', 'Armature 12B1250', 8),
('ARM_12B1600', 'Armature 12B1600', 9),
('ARM_12B2000', 'Armature 12B2000', 10),
('ARM_10B2000', 'Armature 10B2000', 11);

-- Initialisation des stocks à zéro
INSERT INTO pba_stock (pba_product_id, initial_stock, current_stock)
SELECT id, 0, 0 FROM pba_products;

INSERT INTO armature_stock (armature_id, current_stock)
SELECT id, 0 FROM armatures;

INSERT INTO material_stock (material_id, current_stock, unit)
SELECT id, 0, unit FROM materials;

-- Utilisateur administrateur par défaut (mot de passe: admin123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES
('admin', 'admin@docc.sn', '$2b$10$rOvHPx7VgCXvK/9JKJ9rw.XkU9lqrX8Q8rR5F5F5F5F5F5F5F5F5F', 'Admin', 'DOCC', 'admin');

-- Indexes pour améliorer les performances
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX idx_daily_reports_user ON daily_reports(user_id);
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_stock_movements_product ON pba_stock_movements(pba_product_id);
CREATE INDEX idx_stock_movements_date ON pba_stock_movements(created_at);

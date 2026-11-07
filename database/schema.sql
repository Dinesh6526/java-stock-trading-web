-- TradeSim schema (MySQL 5.7+ / 8.x, MariaDB 10.3+)
-- The server runs this file automatically on start-up, so you normally do not
-- need to run it yourself. To do it by hand:
--   CREATE DATABASE tradesim CHARACTER SET utf8mb4;  USE tradesim;  then run this file.

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(20)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  balance       DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stocks (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  symbol          VARCHAR(12)  NOT NULL UNIQUE,
  name            VARCHAR(80)  NOT NULL,
  sector          VARCHAR(40)  NOT NULL,
  price           DECIMAL(12,2) NOT NULL,
  prev_close      DECIMAL(12,2) NOT NULL,
  prev_close_date DATE NOT NULL,
  base_price      DECIMAL(12,2) NOT NULL,
  volatility      DECIMAL(6,4)  NOT NULL DEFAULT 0.0030
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS price_history (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  stock_id    INT NOT NULL,
  price       DECIMAL(12,2) NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_history_stock (stock_id, id),
  FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS holdings (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  stock_id   INT NOT NULL,
  quantity   INT NOT NULL,
  total_cost DECIMAL(15,2) NOT NULL,
  UNIQUE KEY uq_user_stock (user_id, stock_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  stock_id    INT NOT NULL,
  type        ENUM('BUY','SELL') NOT NULL,
  quantity    INT NOT NULL,
  price       DECIMAL(12,2) NOT NULL,
  total       DECIMAL(15,2) NOT NULL,
  realized_pl DECIMAL(15,2) NULL,            -- only filled for SELL rows
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tx_user (user_id, id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

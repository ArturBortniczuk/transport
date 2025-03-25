import db from './db';

export const userMethods = {
  verifyUser(id, password) {
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND password = ?')
      .get(id, password);
    return user != null;
  },

  getUser(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
};

export const transportMethods = {
  getAllTransports() {
    return db.prepare('SELECT * FROM transports ORDER BY delivery_date DESC').all();
  },

  getTransportsByDate(date) {
    return db.prepare(
      'SELECT * FROM transports WHERE date(delivery_date) = date(?) ORDER BY delivery_date ASC'
    ).all(date);
  },

  addTransport(transportData) {
    const {lastInsertRowid} = db.prepare(`
      INSERT INTO transports (
        source_warehouse, destination_city, postal_code, street,
        latitude, longitude, distance, driver_id, status,
        wz_number, client_name, market, loading_level,
        notes, is_cyclical, delivery_date
      ) VALUES (
        @source_warehouse, @destination_city, @postal_code, @street,
        @latitude, @longitude, @distance, @driver_id, @status,
        @wz_number, @client_name, @market, @loading_level,
        @notes, @is_cyclical, @delivery_date
      )
    `).run(transportData);
    return lastInsertRowid;
  },

  updateTransport(id, transportData) {
    const fields = Object.keys(transportData)
      .map(key => `${key} = @${key}`)
      .join(', ');
    
    return db.prepare(`
      UPDATE transports 
      SET ${fields}
      WHERE id = @id
    `).run({ ...transportData, id });
  },

  deleteTransport(id) {
    return db.prepare('DELETE FROM transports WHERE id = ?').run(id);
  }
};
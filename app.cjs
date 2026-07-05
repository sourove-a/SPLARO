/**
 * Passenger startup file (PassengerStartupFile app.cjs points at the repo
 * checkout root). Committed so hPanel's wipe-on-deploy can never delete the
 * entry the LiteSpeed vhosts depend on. Same behaviour as server.js.
 */
require('./server.js')

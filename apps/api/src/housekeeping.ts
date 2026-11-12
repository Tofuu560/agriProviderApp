import { db,connect } from './core.js';import { housekeeping } from './jobs.js';await connect();await housekeeping();await db.$disconnect();

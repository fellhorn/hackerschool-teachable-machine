import Dexie from 'dexie';

const db = new Dexie('hackerschool');
db.version(1).stores({
    classifiers: `name, labels, dataset, originalImages`
});

export default db;
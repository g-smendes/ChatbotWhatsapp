// Funções auxiliares
const { sectors, tasks } = require('../config');

function getSectorByOption(option) {
    return sectors.find(sector => sector.option === option);
}

function getSectorById(id) {
    return sectors.find(sector => sector.id === id);
}

function getTaskById(id) {
    return tasks[id];
}

function getSectorServices(sectorId) {
    const sectorConfig = getSectorById(sectorId);
    return sectorConfig ? sectorConfig.services : [];
}

module.exports = {
    getSectorByOption,
    getSectorById,
    getTaskById,
    getSectorServices,
};
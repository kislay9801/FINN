import { refreshData } from "../src/server/ingestion";
import { evaluateScheduledAlerts } from "../src/server/alerts";
const data = await refreshData();
console.log(
  JSON.stringify(
    { health: data.health, newAlerts: await evaluateScheduledAlerts(data) },
    null,
    2,
  ),
);

import { seedQaUsers, disconnectQaDb } from "./helpers/db";

export default async function globalSetup() {
  await seedQaUsers();
  await disconnectQaDb();
}

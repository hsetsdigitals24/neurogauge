import { deleteQaData, disconnectQaDb } from "./helpers/db";

export default async function globalTeardown() {
  await deleteQaData();
  await disconnectQaDb();
}

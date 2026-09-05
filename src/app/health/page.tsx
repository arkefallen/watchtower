import { HealthConsole } from "./HealthConsole";
import { connection } from "next/server";
import "../../../public/watchtower-operations.css";

export default async function HealthPage() {
  await connection();
  return <HealthConsole timeZone={process.env.APP_TIMEZONE ?? "Asia/Jakarta"} />;
}

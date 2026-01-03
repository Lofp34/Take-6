const { execSync } = require("child_process");

function run(command) {
  execSync(command, { stdio: "inherit" });
}

run("npx prisma generate");

if (process.env.DATABASE_URL) {
  run("npx prisma migrate deploy");
} else {
  console.log("Skipping prisma migrate deploy (DATABASE_URL not set).");
}

run("next build");

// De publieke pagina's lezen via dezelfde Prisma-client als de rest van de app,
// zodat er maar een pool is.
export { prisma as db } from "@/lib/db";

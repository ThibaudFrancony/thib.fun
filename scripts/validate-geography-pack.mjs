// Compatibilité avec l'ancien point d'entrée : la validation pure vit dans
// scripts/geography et n'écrit plus aucun pack ni fichier SQL.
await import("./geography/validate-pack.mjs");

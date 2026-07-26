import {
  INGREDIENT_DATABASE,
  Ingredient,
  Recipe,
  RECIPES,
  SEED_VERSION,
} from "./recipes";

export type StoredIngredient = Ingredient & {
  source: "seed" | "user";
};

export type StoredRecipe = Recipe & {
  source: "seed" | "user";
  imageSource: "seed" | "upload" | "none";
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = "smartrecipe-local-db";
const DB_VERSION = 2;

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function openRecipeDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("recipes")) {
        const store = db.createObjectStore("recipes", { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("source", "source", { unique: false });
      }
      if (!db.objectStoreNames.contains("ingredients")) {
        const store = db.createObjectStore("ingredients", { keyPath: "name" });
        store.createIndex("source", "source", { unique: false });
        store.createIndex("category", "category", { unique: false });
      } else {
        const transaction = request.transaction;
        const store = transaction?.objectStore("ingredients");
        if (store && !store.indexNames.contains("category")) {
          store.createIndex("category", "category", { unique: false });
        }
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };

    request.onsuccess = async () => {
      try {
        await seedDatabase(request.result);
        resolve(request.result);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function seedDatabase(db: IDBDatabase) {
  const currentMeta = await requestToPromise<{ key: string; value: string } | undefined>(
    db.transaction("meta", "readonly").objectStore("meta").get("seedVersion"),
  );

  if (currentMeta?.value === SEED_VERSION) return;

  const now = Date.now();
  const existingIngredients = await requestToPromise<StoredIngredient[]>(
    db.transaction("ingredients", "readonly").objectStore("ingredients").getAll(),
  ).catch(() => []);
  const userIngredients = existingIngredients.filter(
    (ingredient) => ingredient.source === "user",
  );

  const transaction = db.transaction(["recipes", "ingredients", "meta"], "readwrite");
  const recipesStore = transaction.objectStore("recipes");
  const ingredientsStore = transaction.objectStore("ingredients");
  const metaStore = transaction.objectStore("meta");

  for (const recipe of RECIPES) {
    const existing = await requestToPromise<StoredRecipe | undefined>(
      recipesStore.get(recipe.id),
    );
    const keepsUploadedImage =
      existing?.imageSource === "upload" && existing.image.startsWith("data:");
    const seeded: StoredRecipe = {
      ...recipe,
      source: "seed",
      image: keepsUploadedImage ? existing.image : recipe.image,
      imageSource: keepsUploadedImage
        ? "upload"
        : recipe.image
          ? "seed"
          : "none",
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing?.updatedAt ?? now,
    };
    recipesStore.put(seeded);
  }

  ingredientsStore.clear();
  for (const ingredient of INGREDIENT_DATABASE) {
    ingredientsStore.put({ ...ingredient, source: "seed" });
  }
  for (const ingredient of userIngredients) {
    ingredientsStore.put(ingredient);
  }

  metaStore.put({ key: "seedVersion", value: SEED_VERSION });
  await transactionDone(transaction);
}

export async function getAllRecipes(db: IDBDatabase) {
  return requestToPromise<StoredRecipe[]>(
    db.transaction("recipes", "readonly").objectStore("recipes").getAll(),
  );
}

export async function getAllIngredients(db: IDBDatabase) {
  return requestToPromise<StoredIngredient[]>(
    db.transaction("ingredients", "readonly").objectStore("ingredients").getAll(),
  );
}

export async function saveIngredient(
  db: IDBDatabase,
  ingredient: StoredIngredient,
) {
  const transaction = db.transaction("ingredients", "readwrite");
  transaction.objectStore("ingredients").put(ingredient);
  await transactionDone(transaction);
}

export async function saveRecipe(db: IDBDatabase, recipe: StoredRecipe) {
  const transaction = db.transaction("recipes", "readwrite");
  transaction.objectStore("recipes").put(recipe);
  await transactionDone(transaction);
}

export async function saveRecipeImage(
  db: IDBDatabase,
  recipe: StoredRecipe,
  imageDataUrl: string,
) {
  await saveRecipe(db, {
    ...recipe,
    image: imageDataUrl,
    imageSource: "upload",
    updatedAt: Date.now(),
  });
}

function snakeToCamelKey(key: string): string {
	return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function camelToSnakeKey(key: string): string {
	return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function snakeToCamel(obj: unknown): unknown {
	if (Array.isArray(obj)) {
		return obj.map((item) => snakeToCamel(item));
	}
	if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			result[snakeToCamelKey(key)] = snakeToCamel(value);
		}
		return result;
	}
	return obj;
}

export function camelToSnake(obj: unknown): unknown {
	if (Array.isArray(obj)) {
		return obj.map((item) => camelToSnake(item));
	}
	if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			result[camelToSnakeKey(key)] = camelToSnake(value);
		}
		return result;
	}
	return obj;
}

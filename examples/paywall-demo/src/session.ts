// A fake login: the signed-in user's ID lives in a cookie. Use your real login instead.
import type { NextFunction, Request, Response } from 'express';
import { type User, findUser } from './store.js';

const COOKIE = 'demo_user';

export function signIn(res: Response, userId: string): void {
	res.cookie(COOKIE, userId, { httpOnly: true, sameSite: 'lax', secure: true });
}

export function signOut(res: Response): void {
	res.clearCookie(COOKIE);
}

export function currentUser(req: Request): User | null {
	const match = (req.headers.cookie ?? '').match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
	return findUser(match?.[1]);
}

/** Sends signed-out visitors to the login screen and puts the user on `res.locals.user`. */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
	const user = currentUser(req);
	if (!user) {
		res.redirect(303, '/');
		return;
	}
	res.locals.user = user;
	next();
}

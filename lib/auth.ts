import { cookies } from "next/headers";
import { createPocketBaseClient } from "./pocketbase";

const COOKIE_NAME = process.env.PB_AUTH_COOKIE || "pb_auth";

type AuthCookiePayload = {
  token: string;
  model: {
    id: string;
    email: string;
    collectionName: string;
    [key: string]: unknown;
  };
};

export async function getAuthFromCookie() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(COOKIE_NAME)?.value;

  if (!authCookie) {
    return null;
  }

  try {
    const parsed = JSON.parse(authCookie) as AuthCookiePayload;

    if (!parsed?.token || !parsed?.model?.id) {
      return null;
    }

    const pb = createPocketBaseClient();
    pb.authStore.save(parsed.token, parsed.model);

    try {
      await pb.collection("users").authRefresh();
    } catch {
      return null;
    }

    return {
      token: pb.authStore.token,
      user: pb.authStore.record,
    };
  } catch {
    return null;
  }
}

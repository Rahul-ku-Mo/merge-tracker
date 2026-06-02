import type { ProviderId } from "../types/index";
import type { Provider } from "./types";
import { gitlabProvider } from "./gitlab";
import { githubProvider } from "./github";
import { bitbucketProvider } from "./bitbucket";

const PROVIDERS: Record<ProviderId, Provider> = {
  gitlab: gitlabProvider,
  github: githubProvider,
  bitbucket: bitbucketProvider
};

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS[id];
}

export function listProviders(): Provider[] {
  return Object.values(PROVIDERS);
}

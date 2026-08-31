import { publicApi } from './api'
import { SiteProfile } from './siteProfile'

let siteProfileRequest: Promise<SiteProfile> | null = null

export function loadSiteProfile(): Promise<SiteProfile> {
  if (!siteProfileRequest) {
    siteProfileRequest = publicApi
      .get<SiteProfile>('/site-profile')
      .then((response) => response.data)
      .catch((error) => {
        siteProfileRequest = null
        throw error
      })
  }

  return siteProfileRequest
}

import CreateLinkModal from '../../../src/components/CreateLinkModal.vue'
import {
  createStore,
  defaultComponentMocks,
  defaultPlugins,
  defaultStoreMockOptions,
  mount
} from 'web-test-helpers'
import { mock } from 'jest-mock-extended'
import { PasswordPolicyService } from '../../../src/services'
import { usePasswordPolicyService } from '../../../src/composables/passwordPolicyService'
import { getDefaultLinkPermissions } from '../../../src/helpers/share/link'
import {
  AbilityRule,
  LinkShareRoles,
  Resource,
  Share,
  SharePermissionBit,
  linkRoleContributorFolder,
  linkRoleEditorFile,
  linkRoleEditorFolder,
  linkRoleInternalFile,
  linkRoleInternalFolder,
  linkRoleUploaderFolder,
  linkRoleViewerFile,
  linkRoleViewerFolder
} from '@ownclouders/web-client/src/helpers'
import { PasswordPolicy } from 'design-system/src/helpers'
import { useEmbedMode } from '../../../src/composables/embedMode'
import { ref } from 'vue'

jest.mock('../../../src/composables/embedMode')
jest.mock('../../../src/composables/passwordPolicyService')
jest.mock('../../../src/helpers/share/link', () => ({
  ...jest.requireActual('../../../src/helpers/share/link'),
  getDefaultLinkPermissions: jest.fn()
}))

const selectors = {
  passwordInput: '.link-modal-password-input',
  selectedRoleLabel: '.selected .role-dropdown-list-option-label',
  roleLabels: '.role-dropdown-list-option-label',
  contextMenuToggle: '#link-modal-context-menu-toggle',
  confirmBtn: '.link-modal-confirm',
  cancelBtn: '.link-modal-cancel'
}

describe('CreateLinkModal', () => {
  describe('password input', () => {
    it('should be rendered', () => {
      const { wrapper } = getWrapper()
      expect(wrapper.find(selectors.passwordInput).exists()).toBeTruthy()
    })
    it('should be disabled for internal links', () => {
      const { wrapper } = getWrapper({ defaultLinkPermissions: 0 })
      expect(wrapper.find(selectors.passwordInput).attributes('disabled')).toBeTruthy()
    })
    it('should not be rendered if user cannot create public links', () => {
      const { wrapper } = getWrapper({ userCanCreatePublicLinks: false, defaultLinkPermissions: 0 })
      expect(wrapper.find(selectors.passwordInput).exists()).toBeFalsy()
    })
  })
  describe('link role select', () => {
    it.each([SharePermissionBit.Internal, SharePermissionBit.Read])(
      'uses the link default permissions to retrieve the initial role',
      (defaultLinkPermissions) => {
        const expectedRole = LinkShareRoles.getByBitmask(defaultLinkPermissions, false)
        const { wrapper } = getWrapper({ defaultLinkPermissions })

        expect(wrapper.find(selectors.selectedRoleLabel).text()).toEqual(expectedRole.label)
      }
    )
    describe('available roles', () => {
      it('lists all available roles for a folder', () => {
        const resource = mock<Resource>({ isFolder: true })
        const { wrapper } = getWrapper({ resources: [resource] })
        const folderRoleLabels = [
          linkRoleInternalFolder,
          linkRoleViewerFolder,
          linkRoleEditorFolder,
          linkRoleContributorFolder,
          linkRoleUploaderFolder
        ].map(({ label }) => label)

        for (const label of wrapper.findAll(selectors.roleLabels)) {
          expect(folderRoleLabels.includes(label.text())).toBeTruthy()
        }
      })
      it('lists all available roles for a file', () => {
        const resource = mock<Resource>({ isFolder: false })
        const { wrapper } = getWrapper({ resources: [resource] })
        const fileRoleLabels = [linkRoleInternalFile, linkRoleViewerFile, linkRoleEditorFile].map(
          ({ label }) => label
        )

        for (const label of wrapper.findAll(selectors.roleLabels)) {
          expect(fileRoleLabels.includes(label.text())).toBeTruthy()
        }
      })
      it('lists only the internal role if user cannot create public links', () => {
        const resource = mock<Resource>({ isFolder: false })
        const { wrapper } = getWrapper({
          resources: [resource],
          userCanCreatePublicLinks: false,
          defaultLinkPermissions: 0
        })
        expect(wrapper.findAll(selectors.roleLabels).length).toBe(1)
        expect(wrapper.find(selectors.selectedRoleLabel).text()).toEqual(linkRoleInternalFile.label)
      })
    })
  })
  describe('context menu', () => {
    it('should display the button to toggle the context menu', () => {
      const { wrapper } = getWrapper()
      expect(wrapper.find(selectors.contextMenuToggle).exists()).toBeTruthy()
    })
    it('should not display the button to toggle the context menu if user cannot create public links', () => {
      const { wrapper } = getWrapper({ userCanCreatePublicLinks: false, defaultLinkPermissions: 0 })
      expect(wrapper.find(selectors.contextMenuToggle).exists()).toBeFalsy()
    })
  })
  describe('method "confirm"', () => {
    it('shows an error if a password is enforced but empty', async () => {
      const { wrapper } = getWrapper({ passwordEnforced: true })
      await wrapper.find(selectors.confirmBtn).trigger('click')
      expect(wrapper.vm.password.error).toBeDefined()
    })
    it('does not create links when the password policy is not fulfilled', async () => {
      const { wrapper, storeOptions } = getWrapper({ passwordPolicyFulfilled: false })
      await wrapper.find(selectors.confirmBtn).trigger('click')
      expect(storeOptions.actions.hideModal).not.toHaveBeenCalled()
    })
    it('creates links for all resources', async () => {
      const resources = [mock<Resource>({ isFolder: false }), mock<Resource>({ isFolder: false })]
      const { wrapper, storeOptions } = getWrapper({ resources })
      await wrapper.find(selectors.confirmBtn).trigger('click')
      expect(storeOptions.modules.Files.actions.addLink).toHaveBeenCalledTimes(resources.length)
      expect(storeOptions.actions.hideModal).toHaveBeenCalledTimes(1)
    })
    it('emits event in embed mode including the created links', async () => {
      const resources = [mock<Resource>({ isFolder: false })]
      const { wrapper, storeOptions, mocks } = getWrapper({ resources, embedModeEnabled: true })
      const share = mock<Share>({ url: 'someurl' })
      storeOptions.modules.Files.actions.addLink.mockResolvedValue(share)
      await wrapper.find(selectors.confirmBtn).trigger('click')
      expect(mocks.postMessageMock).toHaveBeenCalledWith('owncloud-embed:share', [share.url])
    })
    it('shows error messages for links that failed to be created', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const resources = [mock<Resource>({ isFolder: false })]
      const { wrapper, storeOptions } = getWrapper({ resources })
      storeOptions.modules.Files.actions.addLink.mockRejectedValue(new Error(''))
      await wrapper.find(selectors.confirmBtn).trigger('click')
      expect(storeOptions.actions.showErrorMessage).toHaveBeenCalledTimes(1)
    })
  })
  describe('method "cancel"', () => {
    it('hides the modal', async () => {
      const { wrapper, storeOptions } = getWrapper()
      await wrapper.find(selectors.cancelBtn).trigger('click')
      expect(storeOptions.actions.hideModal).toHaveBeenCalledTimes(1)
    })
  })
})

function getWrapper({
  resources = [],
  defaultLinkPermissions = 1,
  userCanCreatePublicLinks = true,
  passwordEnforced = false,
  passwordPolicyFulfilled = true,
  embedModeEnabled = false
} = {}) {
  jest.mocked(usePasswordPolicyService).mockReturnValue(
    mock<PasswordPolicyService>({
      getPolicy: () => mock<PasswordPolicy>({ check: () => passwordPolicyFulfilled })
    })
  )
  jest.mocked(getDefaultLinkPermissions).mockReturnValue(defaultLinkPermissions)

  const postMessageMock = jest.fn()
  jest.mocked(useEmbedMode).mockReturnValue(
    mock<ReturnType<typeof useEmbedMode>>({
      isEnabled: ref(embedModeEnabled),
      postMessage: postMessageMock
    })
  )

  const mocks = { ...defaultComponentMocks(), postMessageMock }

  const storeOptions = defaultStoreMockOptions
  storeOptions.getters.capabilities.mockReturnValue({
    files_sharing: {
      public: {
        expire_date: {},
        can_edit: true,
        can_contribute: true,
        alias: true,
        password: { enforced_for: { read_only: passwordEnforced } }
      }
    }
  })

  const store = createStore(storeOptions)
  const abilities = [] as AbilityRule[]
  if (userCanCreatePublicLinks) {
    abilities.push({ action: 'create-all', subject: 'PublicLink' })
  }

  return {
    storeOptions,
    mocks,
    wrapper: mount(CreateLinkModal, {
      props: {
        resources
      },
      global: {
        plugins: [...defaultPlugins({ abilities }), store],
        mocks,
        provide: mocks,
        stubs: { OcTextInput: true, OcDatepicker: true }
      }
    })
  }
}
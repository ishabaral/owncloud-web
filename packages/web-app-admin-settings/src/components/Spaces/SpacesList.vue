<template>
  <div>
    <oc-text-input
      id="spaces-filter"
      v-model="filterTerm"
      class="oc-ml-m oc-my-s"
      :label="$gettext('Filter spaces')"
      autocomplete="off"
    />
    <oc-table
      ref="tableRef"
      class="spaces-table"
      :sort-by="sortBy"
      :sort-dir="sortDir"
      :fields="fields"
      :data="orderedSpaces"
      :highlighted="highlighted"
      :sticky="true"
      :header-position="headerPosition"
      :hover="true"
      @sort="handleSort"
      @highlight="fileClicked"
    >
      <template #selectHeader>
        <oc-checkbox
          size="large"
          class="oc-ml-s"
          :label="$gettext('Select all spaces')"
          :value="allSpacesSelected"
          hide-label
          @input="$emit('toggleSelectAllSpaces')"
        />
      </template>
      <template #select="{ item }">
        <oc-checkbox
          class="oc-ml-s"
          size="large"
          :value="isSpaceSelected(item)"
          :option="item"
          :label="getSelectSpaceLabel(item)"
          hide-label
          @input="$emit('toggleSelectSpace', item)"
          @click.native.stop
        />
      </template>
      <template #icon>
        <oc-icon name="layout-grid" />
      </template>
      <template #name="{ item }">
        <span
          class="spaces-table-space-name"
          :data-test-space-name="item.name"
          v-text="item.name"
        />
      </template>
      <template #manager="{ item }">
        {{ getManagerNames(item) }}
      </template>
      <template #members="{ item }">
        {{ getMemberCount(item) }}
      </template>
      <template #totalQuota="{ item }"> {{ getTotalQuota(item) }} </template>
      <template #usedQuota="{ item }"> {{ getUsedQuota(item) }} </template>
      <template #remainingQuota="{ item }"> {{ getRemainingQuota(item) }} </template>
      <template #mdate="{ item }">
        <span
          v-oc-tooltip="formatDate(item.mdate)"
          tabindex="0"
          v-text="formatDateRelative(item.mdate)"
        />
      </template>
      <template #status="{ item }">
        <span v-if="item.disabled" class="oc-flex oc-flex-middle">
          <oc-icon name="stop-circle" fill-type="line" class="oc-mr-s" /><span
            v-text="$gettext('Disabled')"
          />
        </span>
        <span v-else class="oc-flex oc-flex-middle">
          <oc-icon name="play-circle" fill-type="line" class="oc-mr-s" /><span
            v-text="$gettext('Enabled')"
          />
        </span>
      </template>
      <template #footer>
        <div class="oc-text-nowrap oc-text-center oc-width-1-1 oc-my-s">
          <p class="oc-text-muted">{{ footerTextTotal }}</p>
          <p v-if="filterTerm" class="oc-text-muted">{{ footerTextFilter }}</p>
        </div>
      </template>
    </oc-table>
  </div>
</template>

<script lang="ts">
import { formatDateFromJSDate, formatRelativeDateFromJSDate } from 'web-pkg/src/helpers'
import {
  computed,
  defineComponent,
  getCurrentInstance,
  nextTick,
  onMounted,
  PropType,
  ref,
  unref,
  watch
} from 'vue'
import { SpaceResource } from 'web-client/src/helpers'
import { useTranslations } from 'web-pkg/src/composables'
import { spaceRoleEditor, spaceRoleManager, spaceRoleViewer } from 'web-client/src/helpers/share'
import Mark from 'mark.js'
import Fuse from 'fuse.js'

export default defineComponent({
  name: 'SpacesList',
  props: {
    spaces: {
      type: Array as PropType<SpaceResource[]>,
      required: true
    },
    selectedSpaces: {
      type: Array as PropType<SpaceResource[]>,
      required: true
    },
    headerPosition: {
      type: Number,
      required: true
    }
  },
  emits: ['toggleSelectSpace', 'toggleSelectAllSpaces', 'toggleUnSelectAllSpaces'],
  setup: function (props) {
    const instance = getCurrentInstance().proxy
    const { $gettext, $gettextInterpolate } = useTranslations()
    const sortBy = ref('name')
    const sortDir = ref('asc')
    const filterTerm = ref('')
    const markInstance = ref(undefined)
    const tableRef = ref(undefined)

    const allSpacesSelected = computed(() => props.spaces.length === props.selectedSpaces.length)
    const highlighted = computed(() => props.selectedSpaces.map((s) => s.id))
    const footerTextTotal = computed(() => {
      const translated = $gettext('%{spaceCount} spaces in total')
      return $gettextInterpolate(translated, { spaceCount: props.spaces.length })
    })
    const footerTextFilter = computed(() => {
      const translated = $gettext('%{spaceCount} matching spaces')
      return $gettextInterpolate(translated, { spaceCount: unref(orderedSpaces).length })
    })

    const orderBy = (list, prop, desc) => {
      return [...list].sort((s1, s2) => {
        let a, b

        switch (prop) {
          case 'members':
            a = getMemberCount(s1).toString()
            b = getMemberCount(s2).toString()
            break
          case 'totalQuota':
            a = getTotalQuota(s1).toString()
            b = getTotalQuota(s2).toString()
            break
          case 'usedQuota':
            a = getUsedQuota(s1).toString()
            b = getUsedQuota(s2).toString()
            break
          case 'remainingQuota':
            a = getRemainingQuota(s1).toString()
            b = getRemainingQuota(s2).toString()
            break
          case 'status':
            a = s1.disabled.toString()
            b = s2.disabled.toString()
            break
          default:
            a = s1[prop] || ''
            b = s2[prop] || ''
        }

        return desc ? b.localeCompare(a) : a.localeCompare(b)
      })
    }
    const orderedSpaces = computed(() =>
      filter(orderBy(props.spaces, unref(sortBy), unref(sortDir) === 'desc'), unref(filterTerm))
    )
    const handleSort = (event) => {
      sortBy.value = event.sortBy
      sortDir.value = event.sortDir
    }
    const filter = (spaces, filterTerm) => {
      if (!(filterTerm || '').trim()) {
        return spaces
      }
      const searchEngine = new Fuse(spaces, {
        includeScore: true,
        useExtendedSearch: true,
        threshold: 0.3,
        keys: ['name']
      })

      return searchEngine.search(filterTerm).map((r) => r.item)
    }
    const isSpaceSelected = (space: SpaceResource) => {
      return props.selectedSpaces.some((s) => s.id === space.id)
    }

    const fields = computed(() => [
      {
        name: 'select',
        title: '',
        type: 'slot',
        width: 'shrink',
        headerType: 'slot'
      },
      {
        name: 'icon',
        title: '',
        type: 'slot',
        width: 'shrink'
      },
      {
        name: 'name',
        title: $gettext('Name'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'manager',
        title: $gettext('Manager'),
        type: 'slot'
      },
      {
        name: 'members',
        title: $gettext('Members'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'totalQuota',
        title: $gettext('Total quota'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'usedQuota',
        title: $gettext('Used quota'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'remainingQuota',
        title: $gettext('Remaining quota'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'mdate',
        title: $gettext('Modified'),
        type: 'slot',
        sortable: true
      },
      {
        name: 'status',
        title: $gettext('Status'),
        type: 'slot',
        sortable: true
      }
    ])

    const getManagerNames = (space: SpaceResource) => {
      const allManagers = space.spaceRoles[spaceRoleManager.name]
      const managers = allManagers.length > 2 ? allManagers.slice(0, 2) : allManagers
      let managerStr = managers.map((m) => m.displayName).join(', ')
      if (allManagers.length > 2) {
        managerStr += `... +${allManagers.length - 2}`
      }
      return managerStr
    }
    const formatDate = (date) => {
      return formatDateFromJSDate(new Date(date), instance.$language.current)
    }
    const formatDateRelative = (date) => {
      return formatRelativeDateFromJSDate(new Date(date), instance.$language.current)
    }
    const getTotalQuota = (space: SpaceResource) => {
      return `${space.spaceQuota.total * Math.pow(10, -9)} GB`
    }
    const getUsedQuota = (space: SpaceResource) => {
      if (space.spaceQuota.used === undefined) {
        return '-'
      }
      return `${(space.spaceQuota.used * Math.pow(10, -9)).toFixed(2)} GB`
    }
    const getRemainingQuota = (space: SpaceResource) => {
      if (space.spaceQuota.remaining === undefined) {
        return '-'
      }
      return `${(space.spaceQuota.remaining * Math.pow(10, -9)).toFixed(0)} GB`
    }
    const getMemberCount = (space: SpaceResource) => {
      return (
        space.spaceRoles[spaceRoleManager.name].length +
        space.spaceRoles[spaceRoleEditor.name].length +
        space.spaceRoles[spaceRoleViewer.name].length
      )
    }
    const getSelectSpaceLabel = (space: SpaceResource) => {
      const translated = $gettext('Select %{ space }')
      return $gettextInterpolate(translated, { space: space.name }, true)
    }

    const fileClicked = (data) => {
      const space = data[0]
      instance.$emit('toggleUnSelectAllSpaces')
      instance.$emit('toggleSelectSpace', space)
    }

    onMounted(() => {
      nextTick(() => {
        markInstance.value = new Mark(unref(tableRef).$el)
      })
    })

    watch(filterTerm, () => {
      const instance = unref(markInstance)
      if (!instance) {
        return
      }
      instance.unmark()
      instance.mark(unref(filterTerm), {
        element: 'span',
        className: 'highlight-mark',
        exclude: ['th *', 'tfoot *']
      })
    })

    return {
      allSpacesSelected,
      sortBy,
      sortDir,
      filterTerm,
      footerTextTotal,
      footerTextFilter,
      fields,
      highlighted,
      tableRef,
      filter,
      getManagerNames,
      formatDate,
      formatDateRelative,
      getTotalQuota,
      getUsedQuota,
      getRemainingQuota,
      getMemberCount,
      getSelectSpaceLabel,
      handleSort,
      orderedSpaces,
      fileClicked,
      isSpaceSelected
    }
  }
})
</script>

<style lang="scss">
#spaces-filter {
  width: 16rem;
}

.highlight-mark {
  font-weight: 600;
}

.spaces-table {
  .oc-table-header-cell-actions,
  .oc-table-data-cell-actions {
    white-space: nowrap;
  }

  .oc-table-header-cell-manager,
  .oc-table-data-cell-manager,
  .oc-table-header-cell-totalQuota,
  .oc-table-data-cell-totalQuota,
  .oc-table-header-cell-usedQuota,
  .oc-table-data-cell-usedQuota,
  .oc-table-header-cell-remainingQuota,
  .oc-table-data-cell-remainingQuota {
    display: none;

    @media only screen and (min-width: 1400px) {
      display: table-cell;
    }
  }
}
</style>
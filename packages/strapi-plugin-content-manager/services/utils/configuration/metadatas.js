'use strict';

const _ = require('lodash');
const {
  isSortable,
  isSearchable,
  isVisible,
  isRelation,
} = require('./attributes');
const { formatContentTypeSchema } = require('../../ContentTypes');

const getIdAttribute = schema =>
  _.get(schema, ['options', 'idAttribute'], 'id');
const isIdAttribute = (schema, name) => name === getIdAttribute(schema);

function createDefaultMetadatas(schema) {
  const idAttribute = getIdAttribute(schema);
  const metadatas = Object.keys(schema.attributes).reduce((acc, name) => {
    const defaultMetadata = createDefaultMetadata(schema, name);
    if (isIdAttribute(schema, name)) {
      defaultMetadata.edit = {};
    }
    acc[name] = defaultMetadata;
    return acc;
  }, {});
  metadatas[idAttribute] = {
    edit: {},
    list: {
      label: _.get(metadatas[idAttribute], ['list', 'label'], 'Id'),
      searchable: true,
      sortable: true,
    },
  };
  return metadatas;
}

function createDefaultMainField(schema) {
  const idAttribute = getIdAttribute(schema);
  if (!schema) return idAttribute;

  return (
    Object.keys(schema.attributes).find(
      key => schema.attributes[key].type === 'string'
    ) || idAttribute
  );
}

function createDefaultMetadata(schema, name) {
  const edit = {
    label: _.upperFirst(name),
    description: '',
    placeholder: '',
    visible: isVisible(schema, name),
    editable: true,
  };

  if (isRelation(schema.attributes[name])) {
    const { targetModel, plugin } = schema.attributes[name];
    const targetSchema = getTargetSchema(targetModel, plugin);
    edit.mainField = createDefaultMainField(targetSchema);
  }

  _.assign(
    edit,
    _.pick(_.get(schema, ['config', 'metadatas', name, 'edit'], {}), [
      'label',
      'description',
      'placeholder',
      'visible',
      'editable',
      'mainField',
    ])
  );

  const list = {
    label: _.upperFirst(name),
    searchable: isSearchable(schema, name),
    sortable: isSortable(schema, name),
    ..._.pick(_.get(schema, ['config', 'metadatas', name, 'list'], {}), [
      'label',
      'searchable',
      'sortable',
    ]),
  };

  return { edit, list };
}

/** Synchronisation functions */

async function syncMetadatas(configuration, schema) {
  // clear all keys that do not exist anymore
  if (_.isEmpty(configuration.metadatas)) return createDefaultMetadatas(schema);

  // remove old keys
  const metasWithValidKeys = _.pick(
    configuration.metadatas,
    Object.keys(schema.attributes)
  );

  // add new keys and missing fields
  const metasWithDefaults = _.merge(
    {},
    createDefaultMetadatas(schema),
    metasWithValidKeys
  );
  // clear the invalid mainFields
  const updatedMetas = Object.keys(metasWithDefaults).reduce((acc, key) => {
    const { edit, list } = metasWithDefaults[key];
    const attr = schema.attributes[key];

    let updatedMeta = { edit, list };
    // update sortable attr
    if (list.sortable && !isSortable(schema, key)) {
      _.set(updatedMeta, ['list', 'sortable'], false);
      _.set(acc, [key], updatedMeta);
    }

    if (list.searchable && !isSearchable(schema, key)) {
      _.set(updatedMeta, ['list', 'searchable'], false);
      _.set(acc, [key], updatedMeta);
    }

    if (!_.has(edit, 'mainField')) return acc;

    // remove mainField if the attribute is not a relation anymore
    if (!isRelation(attr)) {
      _.set(updatedMeta, 'edit', _.omit(edit, ['mainField']));
      _.set(acc, [key], updatedMeta);
      return acc;
    }

    // if the mainField is id you can keep it
    if (isIdAttribute(schema, edit.mainField)) return acc;

    // check the mainField in the targetModel
    const targetSchema = getTargetSchema(attr.targetModel, attr.plugin);

    if (!targetSchema) return acc;

    if (!isSortable(targetSchema, edit.mainField)) {
      _.set(
        updatedMeta,
        ['edit', 'mainField'],
        createDefaultMainField(targetSchema)
      );
      _.set(acc, [key], updatedMeta);
      return acc;
    }

    return acc;
  }, {});

  return _.assign(metasWithDefaults, updatedMetas);
}

const getTargetSchema = (name, plugin) => {
  const model = strapi.getModel(name, plugin);
  if (!model) return null;

  return formatContentTypeSchema(model);
};

module.exports = {
  createDefaultMetadatas,
  syncMetadatas,
};

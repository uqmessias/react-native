/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

'use strict';

import type {
  ComponentShape,
  PropTypeShape,
  SchemaType,
} from '../../CodegenSchema';
const {getImports, toSafeJavaString} = require('./JavaHelpers');

// File path -> contents
type FilesOutput = Map<string, string>;

const template = `
package com.facebook.react.viewmanagers;

::_IMPORTS_::

public class ::_CLASSNAME_::<T extends ::_EXTEND_CLASSES_::> {
  public void setProperty(::_INTERFACE_CLASSNAME_::<T> viewManager, T view, String propName, Object value) {
    ::_PROP_CASES_::
  }
}
`;

function getJavaValueForProp(
  prop: PropTypeShape,
  componentName: string,
): string {
  const typeAnnotation = prop.typeAnnotation;

  switch (typeAnnotation.type) {
    case 'BooleanTypeAnnotation':
      return `value == null ? ${typeAnnotation.default.toString()} : (boolean) value`;
    case 'StringTypeAnnotation':
      const defaultValueString =
        typeAnnotation.default === null
          ? 'null'
          : `"${typeAnnotation.default}"`;
      return `value == null ? ${defaultValueString} : (String) value`;
    case 'Int32TypeAnnotation':
      return `value == null ? ${
        typeAnnotation.default
      } : ((Double) value).intValue()`;
    case 'FloatTypeAnnotation':
      if (prop.optional) {
        return `value == null ? ${
          typeAnnotation.default
        }f : ((Double) value).floatValue()`;
      } else {
        return 'value == null ? Float.NaN : ((Double) value).floatValue()';
      }
    case 'NativePrimitiveTypeAnnotation':
      switch (typeAnnotation.name) {
        case 'ColorPrimitive':
          return 'value == null ? null : ((Double) value).intValue()';
        case 'ImageSourcePrimitive':
          return '(ReadableMap) value';
        case 'PointPrimitive':
          return '(ReadableMap) value';
        default:
          (typeAnnotation.name: empty);
          throw new Error('Received unknown NativePrimitiveTypeAnnotation');
      }
    case 'ArrayTypeAnnotation': {
      return '(ReadableArray) value';
    }
    case 'StringEnumTypeAnnotation':
      return '(String) value';
    default:
      (typeAnnotation: empty);
      throw new Error('Received invalid typeAnnotation');
  }
}

function generatePropCasesString(
  component: ComponentShape,
  componentName: string,
) {
  if (component.props.length === 0) {
    return '// No props';
  }

  const cases = component.props
    .map(prop => {
      return `case "${prop.name}":
        viewManager.set${toSafeJavaString(
          prop.name,
        )}(view, ${getJavaValueForProp(prop, componentName)});
        break;`;
    })
    .join('\n' + '      ');

  return `switch (propName) {
      ${cases}
    }`;
}

function getClassExtendString(component): string {
  const extendString = component.extendsProps
    .map(extendProps => {
      switch (extendProps.type) {
        case 'ReactNativeBuiltInType':
          switch (extendProps.knownTypeName) {
            case 'ReactNativeCoreViewProps':
              return 'View';
            default:
              (extendProps.knownTypeName: empty);
              throw new Error('Invalid knownTypeName');
          }
        default:
          (extendProps.type: empty);
          throw new Error('Invalid extended type');
      }
    })
    .join('');

  return extendString;
}

module.exports = {
  generate(libraryName: string, schema: SchemaType): FilesOutput {
    const files = new Map();
    Object.keys(schema.modules).forEach(moduleName => {
      const components = schema.modules[moduleName].components;
      // No components in this module
      if (components == null) {
        return;
      }

      return Object.keys(components).forEach(componentName => {
        const component = components[componentName];
        const className = `${componentName}ViewManagerDelegate`;
        const interfaceClassName = `${componentName}ViewManagerInterface`;
        const fileName = `${className}.java`;

        const imports = getImports(component);
        const propsString = generatePropCasesString(component, componentName);
        const extendString = getClassExtendString(component);

        const replacedTemplate = template
          .replace(
            /::_IMPORTS_::/g,
            Array.from(imports)
              .sort()
              .join('\n'),
          )
          .replace(/::_CLASSNAME_::/g, className)
          .replace(/::_INTERFACE_CLASSNAME_::/g, interfaceClassName)
          .replace('::_EXTEND_CLASSES_::', extendString)
          .replace('::_PROP_CASES_::', propsString);

        files.set(fileName, replacedTemplate);
      });
    });

    return files;
  },
};

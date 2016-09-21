/* global JSONEditor, jQuery */
/* exported InnoDataConverter, InnoJSONValidator, InnoJSONEditor, InnoJSONEditors */
var InnoDataConverter = {
    convert: function (data) {
        var values = [],
            titles = [],
            converted = {};

        if (!Array.isArray(data)) {
            values = data.values || values;
            titles = data.titles || titles;
        } else {
            values = data;
        }

        converted.values = values;
        converted.titles = this.generateTitles(values);
        converted.data = this.generateDataValue(values);

        return converted;
    },

    prepareEvent: function (event) {
        event = event.split('/');

        return (event && event.length === 3) ? {
            app: event[0],
            section: event[1],
            event: event[2]
        } : {};
    },

    getMacroData: function () {
        return {
            codenames: ['CURRENT_TIMESTAMP', 'REQUEST_IP', 'USER_AGENT'],
            display_names: ['Timestamp', 'Request IP', 'User-agent']
        };
    },

    getMetaData: function () {
        return {
            codenames: ['COMPANY_ID', 'BUCKET_ID', 'SECTION', 'COLLECT_APP'],
            display_names: ['Company ID', 'Bucket ID', 'Section', 'Collect app']
        };
    },

    generateTitles: function (values) {
        // you can override it.
        return values;
    },

    generateDataValue: function (els) {
        var newEls = {};
        if (els && els instanceof Array) {
            els.forEach(function (el) {
                var parsed = el.split('/');

                if (!newEls[parsed[0]]) { // app
                    newEls[parsed[0]] = {};
                }
                if (!newEls[parsed[0]][parsed[1]]) { // section
                    newEls[parsed[0]][parsed[1]] = [];
                }

                newEls[parsed[0]][parsed[1]].push(el);
            });
        }
        return newEls;
    }
};

var InnoJSONValidator = {
    map: function (item) {
        var map = {
            empty: this.emptyStringOnRequiredFields
        };

        return map[item];
    },
    emptyStringOnRequiredFields: function (schema, value, path) {
        var errors = [],
            validators = (schema && schema.options && schema.options.validators) || [],
            isHided = !!(schema.options && schema.options.hided);

        if (validators && validators.length && !value && !isHided && !(schema.type === "boolean" && value === false)) {
            errors.push({
                path: path,
                property: "value",
                message: "Field " + (schema.title ? '"' + schema.title + '"' : "") + " cannot be empty"
            });
        }

        return errors;
    },

    getValidators: function (items) {
        var self = this;
        return items.map(function (item) {
            return self.map(item);
        });
    }
};

JSONEditor.AbstractEditor.prototype.getRuleId = function () {
    var id = this.path.match(/^root\.(\d+)/);

    return id ? id[1] : 0;
};

var InnoJSONEditor = function (el, params) {
    this._parent = JSONEditor.prototype;
    var customValidators = params.customValidators,
        self = this;

    delete params.customValidators;

    this.extendedData = {root: params.extendedData || {}};

    JSONEditor.apply(this, arguments);
    this.validator.validate = function () {
        return self.validate();
    };

    this.attachEvents();
    this.addCustomValidators(customValidators);
};

InnoJSONEditor.constructor = InnoJSONEditor;
InnoJSONEditor.prototype = Object.assign(Object.create(JSONEditor.prototype), {
    attachEvents: function () {

    },

    getRuleId: function (editor) {
        return editor.getRuleId();
    },

    validate: function (node) {
        return this._validate(node || this.editors.root);
    },

    showEditor: function (editor) {
        var schema = editor.schema;

        if (!schema.options) {
            schema.options = {};
        }

        schema.options.hided = false;
        jQuery(editor.container).show();
    },

    resetEditor: function (editor) {
        var value;
        if (!editor.input) {
            return;
        }

        switch (editor.schema.type) {
            case "boolean":
                value = false;
                break;
            default:
                value = "";
        }

        editor.setValue(value);
    },

    hideEditor: function (editor, withReset) {
        var schema = editor.schema;

        if (!schema.options) {
            schema.options = {};
        }

        schema.options.hided = true;
        jQuery(editor.container).hide();

        if (withReset) {
            this.resetEditor(editor);
        }
    },

    _validate: function (node) {
        var errors = [],
            groupNode = false,
            i, iLen;

        if (node.editors) {
            var editors = node.editors;
            groupNode = true;
            for (i in editors) {
                if (!editors.hasOwnProperty(i)) {
                    continue;
                }

                errors = errors.concat(this._validate(editors[i]));
            }
        }

        if (node.rows) {
            var rows = node.rows;
            groupNode = true;
            for (i = 0, iLen = rows.length; i < iLen; i++) {
                errors = errors.concat(this._validate(rows[i]));
            }
        }

        if (!groupNode) {
            errors = this.validator._validateSchema(node.schema, node.getValue(), node.path);
            if (node.input) {
                node.showValidationErrors(errors);
            }
        }

        return errors;
    },

    trigger: function (event, data) {
        if (this.callbacks && this.callbacks[event] && this.callbacks[event].length) {
            for (var i = 0; i < this.callbacks[event].length; i++) {
                this.callbacks[event][i](data);
            }
        }

        return this;
    },

    getEditorClass: function (schema) {
        var classname;

        schema = this.expandSchema(schema);

        var resolvers = JSONEditor.defaults.resolvers;

        for (var i = 0, rLen = resolvers.length; i < rLen; i++) {
            classname = resolvers[i](schema);

            if (classname) {
                break;
            }
        }

        return InnoJSONEditors[classname] || JSONEditor.defaults.editors[classname];
    },

    updateExtendedData: function (data, id) {
        var old,
            exData = this.getExtendedData(id);
        for (var item in data) {
            if (!data.hasOwnProperty(item)) {
                continue;
            }

            old = exData[item];
            exData[item] = data[item];

            if (old !== data[item]) {
                this.updateExtendedDataEditors(this.editors, item);
            }
        }

        this.setExtendedData(exData, id);
    },

    getExtendedData: function (id) {
        return this.extendedData[id] || {};
    },

    setExtendedData: function (data, id) {
        this.extendedData[id] = data;
    },

    updateExtendedDataEditors: function (list, property) {
        for (var one in list) {
            if (!list.hasOwnProperty(one)) {
                continue;
            }

            var editor = list[one],
                ruleId = this.getRuleId(editor),
                exData = this.getExtendedData(ruleId),
                rootData = this.getExtendedData("root");

            if (editor.schema && editor.schema.options && editor.schema.options.extended_data_mapping && editor.schema.options.extended_data_mapping === property) {
                editor.update(exData[property] || rootData[property]);
            }
        }
    },

    processDependency: function (editor, depConf) {
        if (editor && depConf) {
            switch (depConf.type) {
                case "show_current_and_hide_others":
                    this.showHideAllEditors(editor, depConf);
                    break;
                case "hide_on_blank":
                    this.hideOnBlankEditors(editor, depConf);
                    break;
                case "show_only_specified":
                    this.showOnlySpecified(editor, depConf);
                    break;
            }
        }
    },

    hideOnBlankEditors: function (editor, dependency) {
        var deps = dependency.conf,
            editors = editor.editors,
            isBlank = true,
            self = this,
            key, current, needToShow;

        var isNeed = function (item) {
            item = editors[item];

            if (!item) {
                return;
            }

            if (isBlank) {
                self.hideEditor(item, true);
            } else {
                self.showEditor(item);
            }
        };

        for (key in deps) {
            if (!deps.hasOwnProperty(key)) {
                continue;
            }

            current = editors[key];
            needToShow = deps[key];

            if (current && (current.getValue() && current.getExtendedValue() !== null)) {
                isBlank = false;
            }

            needToShow.forEach(isNeed);
        }
    },

    showHideAllEditors: function (editor, dependency) {
        var needToShow = [];
        var deps = dependency.conf;
        var editors = editor.editors,
            key, current;

        for (key in deps) {
            if (!deps.hasOwnProperty(key)) {
                continue;
            }

            current = editors[key];

            if (!current) {
                continue;
            }

            needToShow.push(key);

            var value = current.getValue(),
                depConf = deps[key][value];

            if (!depConf && !Array.isArray(depConf)) {
                continue;
            }

            needToShow = needToShow.concat(depConf);
        }

        for (key in editors) {
            if (!editors.hasOwnProperty(key)) {
                continue;
            }

            current = editors[key];

            if (needToShow.indexOf(key) < 0) {
                this.hideEditor(current, true);
            } else {
                this.showEditor(current);
            }
        }

        if (editor.parent.editors.fieldSets.container) {
            var fields = Array.prototype.slice.call(editor.parent.editors.fieldSets.container.querySelectorAll('tbody>tr>td')).filter(function (td) {
                if (td.dataset.schemapath) {
                    return td.dataset.schemapath.indexOf('fieldName') > -1;
                }
                return;
            });
            var settings = editor.getValue();
            fields.map(function (field) {
                var name = field.querySelector('input').value;
                if (settings.type === 'starter') {
                    field.parentElement.style.display = ['mailHash', 'searchType', 'departure', 'destination', 'homeDate', 'outDate', 'adults', 'children', 'source', 'tripType', 'channel', 'taskId'].indexOf(name) > -1 ? '' : 'none';
                } else if (settings.type === 'stopper') {
                    field.parentElement.style.display = ['taskId'].indexOf(name) > -1 ? '' : 'none';
                }
            });
        }
    },

    showOnlySpecified: function (editor, dependency) {
        var deps = dependency.conf,
            editors = editor.editors,
            needToShow = {},
            self = this,
            current, key, value, eds, ed, items, tempEditor;

        for (key in deps) {
            if (!deps.hasOwnProperty(key)) {
                continue;
            }

            eds = deps[key];
            current = editors[key];

            if (!current) {
                value = false;
            } else {
                value = current.getValue();
            }

            for (ed in eds) {
                if (!eds.hasOwnProperty(ed)) {
                    continue;
                }

                items = eds[ed];

                items.forEach(function (item) {
                    tempEditor = editors[item];
                    if (!tempEditor) {
                        return;
                    }

                    if (value === ed) {
                        needToShow[item] = true;
                        self.showEditor(tempEditor);
                    } else {
                        if (!needToShow[item]) {
                            self.hideEditor(tempEditor, true);
                        }
                    }
                });
            }
        }
    },

    addCustomValidators: function () {
        JSONEditor.defaults.custom_validators = JSONEditor.defaults.custom_validators.concat(InnoJSONValidator.getValidators(this.getValidatorsConfig()));
    },

    getValidatorsConfig: function () {
        return [
            'empty'
        ];
    },

    _getExternalRefs: function (schema) {
        if (schema === null) {
            return {};
        }

        return this._parent._getExternalRefs.call(this, schema);
    }
});

var InnoJSONEditors = {};

InnoJSONEditors.object = JSONEditor.defaults.editors.object.extend({
    onChildEditorChange: function (editor) {
        this.jsoneditor.trigger('editor-changed', editor);
        this.refreshValue();
        this.processDeps();
        this.validate();
    },

    processDeps: function () {
        if (this.schema.options && this.schema.options.dependencies) {
            var deps = this.schema.options.dependencies,
                self = this;

            deps.forEach(function (depConf) {
                self.jsoneditor.processDependency(self, depConf);
            });
        }
    },

    getDefault: function () {
        var def = this._super();

        if (def.hasOwnProperty("id")) {
            def.id = Date.now();
        }

        if (def.hasOwnProperty("name")) {
            def.name = this.schema.title || 'Rule';
        }

        return def;
    },

    postBuild: function () {
        this._super();

        this.processDeps();
    },

    getValue: function () {
        this.refreshValue();
        return this._super();
    },

    refreshValue: function () {
        this.value = {};
        var one;

        for (var i in this.editors) {
            if (!this.editors.hasOwnProperty(i)) {
                continue;
            }

            one = this.editors[i];

            if (!(one.schema && one.schema.options && one.schema.options.dependencies && one.schema.options.hided)) {
                this.value[i] = one.getValue();
            }
        }

        if (this.adding_property) {
            this.refreshAddProperties();
        }
    },

    validate: function () {
        this.jsoneditor.validate(this);
    }
});

InnoJSONEditors.array = JSONEditor.defaults.editors.array.extend({
    getValue: function () {
        this.refreshValue();
        return this._super();
    },

    destroyRow: function (row) {
        this.row_cache = [];
        this._super(row, true);
    }
});

InnoJSONEditors.table = JSONEditor.defaults.editors.table.extend({
    addRow: function (value) {
        var defVal = this.hide_delete_buttons;
        if (value && value.options && value.options.permanent) {
            this.hide_delete_buttons = true;
        }

        this._super(value);

        if (value && value.options && value.options.readonly && Array.isArray(value.options.readonly)) {
            var lastRow = this.rows[this.rows.length - 1],
                readonly = value.options.readonly;

            if (lastRow) {
                var editors = lastRow.editors;
                for (var key in editors) {
                    if (!editors.hasOwnProperty(key)) {
                        continue;
                    }

                    if (readonly.indexOf(key) >= 0) {
                        editors[key].disable();
                    }
                }
            }
        }

        this.hide_delete_buttons = defVal;
    },

    addControls: function () {
        this._super();
        this.remove_all_rows_button.style.display = "none";
        this.remove_all_rows_button = {
            style: {}
        };
        this.delete_last_row_button.style.display = "none";
        this.delete_last_row_button = {
            style: {}
        };
    },

    getValue: function () {
        this.refreshValue();
        return this._super();
    }
});

InnoJSONEditors.select = JSONEditor.defaults.editors.select.extend({
    preBuild: function () {
        this._super();

        if (this.schema.type === "boolean") {
            this.enum_options = this.enum_options.map(function (item) {
                return item === "1" ? "true" : "false";
            });
        }

        if (this.enum_values[0] === undefined) {
            this.enum_display[0] = " - Select value - ";
            this.enum_options[0] = "";
            this.enum_values[0] = "";
        }

        if (this.schema && this.schema.options && this.schema.options.extended_data_mapping) {
            this.appendExtendedFields(this.schema.options.extended_data_mapping);
        }
    },

    build: function () {
        this._super();
        this.appendErrorHolder();
    },

    appendErrorHolder: function () {
        var input = this.input,
            parent = input.parentNode,
            errorEl = document.createElement('p');

        errorEl.className = "help-block errormsg";
        parent.appendChild(errorEl);
        this.error_holder = errorEl;
    },

    appendExtendedFields: function (key) {
        var exData = this.jsoneditor.getExtendedData(this.getRuleId()),
            rootData = this.jsoneditor.getExtendedData("root"),
            data = exData[key] || rootData[key];

        if (data) {
            this.enum_display = this.enum_display.concat(data);
            this.enum_values = this.enum_values.concat(data);
            this.enum_options = this.enum_options.concat(data);

            this.schema["enum"] = this.enum_values;
        }
    },

    update: function () {
        var container = this.container;

        container.innerHTML = '';

        this.preBuild();
        this.build();
        this.postBuild();
    },

    getExtendedValue: function () {
        var value = this.getValue(),
            opts = this.schema["enum"],
            options = this.schema.options,
            pos = opts.indexOf(value);

        return (pos >= 0 && options && options.enum_data_properties) ? options.enum_data_properties[pos] : "";
    },

    showValidationErrors: function (errors) {
        var my_errors = [],
            self = this;

        errors.forEach(function (error) {
            if (error.path === self.path) {
                my_errors.push(error);
            }
        });

        if (my_errors.length > 0) {
            this.showErrorHolder(my_errors);
        } else {
            this.hideErrorHolder();
        }
    },

    hideErrorHolder: function () {
        this.error_holder.innerHTML = '';
        this.error_holder.style.display = "none";
        this.input.parentNode.classList.remove("has-error");
    },

    showErrorHolder: function (errors) {
        var first = errors[0];
        this.error_holder.innerHTML = first.message;
        this.error_holder.style.display = "initial";

        this.input.parentNode.classList.add("has-error");
    },

    onInputChange: function () {
        this._super();
        this.validate();
    },

    validate: function () {
        var editor = this.jsoneditor,
            self = this,
            errors = editor.validator._validateSchema(this.schema, this.getValue());

        errors = errors.map(function (error) {
            error.path = self.path;
            return error;
        });
        this.showValidationErrors(errors);
    },

    setValue: function (value, initial) {
        var changed = this.getValue() !== value;
        this._super(value, initial);

        if (changed && this.parent) {
            this.parent.onChildEditorChange(this);
        }
    }
});

InnoJSONEditors.string = JSONEditor.defaults.editors.string.extend({
    validate: function () {
        var editor = this.jsoneditor,
            self = this,
            errors = editor.validator._validateSchema(this.schema, this.getValue());

        errors = errors.map(function (error) {
            error.path = self.path;
            return error;
        });
        this.showValidationErrors(errors);
    },

    showValidationErrors: function (errors) {
        var my_errors = [],
            self = this;

        errors.forEach(function (error) {
            if (error.path === self.path) {
                my_errors.push(error);
            }
        });

        if (my_errors.length > 0) {
            this.showErrorHolder(my_errors);
        } else {
            this.hideErrorHolder();
        }
    },

    hideErrorHolder: function () {
        this.error_holder.innerHTML = '';
        this.error_holder.style.display = "none";
        this.input.parentNode.classList.remove("has-error");
    },

    showErrorHolder: function (errors) {
        var first = errors[0];
        this.error_holder.innerHTML = first.message;
        this.error_holder.style.display = "initial";

        this.input.parentNode.classList.add("has-error");
    },

    appendErrorHolder: function () {
        var input = this.input,
            parent = input.parentNode,
            errorEl = document.createElement('p');

        errorEl.className = "help-block errormsg";
        parent.appendChild(errorEl);
        this.error_holder = errorEl;
    },

    build: function () {
        this._super();

        this.appendErrorHolder();
    },

    getValue: function () {
        return this._super();
    }
});

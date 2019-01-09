import {
	createMediaFromFile,
	hashFile,
	removeFromBlocking,
	removeFromPending,
	removeFromUploadStarted,
	setBlocking
} from './util'

/**
 * Manage response of file upload requests
 *
 * @since 1.8.0
 *
 * @param {object} response generated by hashFile() => createMediaFromFile()
 * @param {object} cf2 fields config with status set
 * @param {object} $form object
 * @param {object} messages to be passed for different responses
 * @param {object} field we are processing files for
 * @param {boolean} lastFile true if last file to be processed
 */
export const handleFileUploadResponse = (response,cf2,$form,messages,field,lastFile) => {

	const {fieldId} = field;
	if( 'object' !== typeof response ){
		removeFromUploadStarted(fieldId,cf2);
		removeFromPending(fieldId,cf2);
		throw 'Upload Error';
	}else if (response.hasOwnProperty('control')) {
		removeFromPending(fieldId,cf2);
		removeFromBlocking(fieldId,cf2);
		cf2.uploadCompleted.push(fieldId);
		if(lastFile){
			$form.submit();
		}
	}else{
		if( response.hasOwnProperty('message') ){
			messages[field.fieldIdAttr] = {
				error: true,
				message: response.hasOwnProperty('message') ? response.message : 'Invalid'
			};
		}
		removeFromUploadStarted(fieldId,cf2);
		removeFromPending(fieldId,cf2);
		throw response;
	}
};

/**
 * Manage response of file upload failure
 *
 * @since 1.8.0
 *
 * @param {object} error generated by promise
 * @param {File} file blob
 */
export const handleFileUploadError = (error, file) => {
	if( error.hasOwnProperty('message') ){
		console.log( error.message );
	}else{
		console.log( 'Error: ' + file.name + ' could not be processed');
	}

};

/**
 * Hash a file then upload it
 *
 * @since 1.8.0
 *
 * @param {File} file File blob
 * @param {object} processData object of data to process files {verify, field, fieldId, cf2, $form, CF_API_DATA, messages}
 * @param {object} processFunctions object of functions that will be called within processFiles then test the cases they are called {hashAndUpload, hashFile, createMediaFromFile, handleFileUploadResponse, handleFileUploadError}
 */
export const hashAndUpload = (file, processData, processFunctions ) => {

	const {verify, field, cf2, $form, CF_API_DATA, messages, lastFile} = processData;
	const {hashFile, createMediaFromFile, handleFileUploadResponse, handleFileUploadError} = processFunctions;

	const API_FOR_FILES_URL = CF_API_DATA.rest.fileUpload;
	const _wp_nonce = CF_API_DATA.rest.nonce;

	if (file instanceof File || file instanceof Blob) {

		hashFile(file, (hash) => {
			const additonalData = {
				hashes: [hash],
				verify,
				formId: field.formId,
				fieldId: field.fieldId,
				control: field.control,
				_wp_nonce,
				API_FOR_FILES_URL
			}
			createMediaFromFile(file, additonalData, fetch )
			.then(
				response => response.json()
			)
			.then(
				response => handleFileUploadResponse(response,cf2,$form,messages,field,lastFile)
			)
			.catch(
				error => {
					handleFileUploadError(error, file);
				}
			);
		});

	}
}

/**
 * Trigger the process on array of files
 *
 * @since 1.8.0
 *
 * @param {array} files array of Files
 * @param {object} processData object of data to process files {verify, field, fieldId, cf2, $form, CF_API_DATA, messages}
 * @param {object} processFunctions object of functions that will be called within processFiles then test the cases they are called {hashAndUpload, hashFile, createMediaFromFile, handleFileUploadResponse, handleFileUploadError}
 */
export const processFiles = (files, processData, processFunctions) => {

	const {hashAndUpload, handleFileUploadError} = processFunctions;

	files.forEach(( file, index, array) => {
			if( Array.isArray( file ) ){
				file = file[0];
			}

			if( index === array.length - 1){
				processData.lastFile = true;
			}else{
				processData.lastFile = false;
			}

			try{
				hashAndUpload(file, processData, processFunctions);
			} catch(error){
				handleFileUploadError(error, file);
			}

		}
	);
}

/**
 * Pre-process Files by File field
 *
 * @since 1.8.0
 *
 * @param {object} processData object of data to process files {obj, values, field, fieldId, cf2, $form, CF_API_DATA, messages}
 * @param {object} processFunctions object of functions that will be called within processFiles then test the cases they are called {hashAndUpload, hashFile, createMediaFromFile, handleFileUploadResponse, handleFileUploadError}
 */
export const processFileField = (processData, processFunctions) => {

	const {processFiles} = processFunctions;
	const {obj, values, cf2, field, fieldId, theComponent} = processData;
	const {fieldIdAttr} = field;
	//do not upload after complete
	if ( cf2.uploadCompleted.includes(fieldId)) {
		removeFromPending(fieldId,cf2);
		removeFromBlocking(fieldId,cf2);
		return;
	}
	//do not start upload if it has started uploading
	if (-1 <= cf2.uploadStarted.indexOf(_fieldId => _fieldId === fieldId )
		&& -1 <= cf2.pending.indexOf(_fieldId => _fieldId === fieldId)
	) {
		cf2.uploadStarted.push(fieldId);
		obj.$form.data(fieldId, field.control);
		cf2.pending.push(fieldId);
		processData.verify = jQuery(`#_cf_verify_${field.formId}`).val();
		if( '' === values[fieldId] ){
			if( theComponent.isFieldRequired(fieldIdAttr) ){
				theComponent.addFieldMessage( fieldIdAttr, "Field is required" );
				shouldBeValidating = true;
				setBlocking(fieldId,cf2);
			}
			removeFromPending(fieldId,cf2);
			return;
		}
		removeFromBlocking(fieldId,cf2);
		const files = values[fieldId];
		processFiles(files, processData, processFunctions);
	}
}

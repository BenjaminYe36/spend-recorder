import React, {useEffect, useState} from 'react';
import './App.css';
import dayjs, {Dayjs} from 'dayjs';
import {Button, FormControl, InputAdornment, InputLabel, MenuItem, Select, TextField} from '@mui/material';
import Autocomplete, {createFilterOptions} from '@mui/material/Autocomplete';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import PublicGoogleSheetsParser from 'public-google-sheets-parser';
import {UniqueSet} from '@sepiariver/unique-set';

import {categories, subCategories} from "./categoryData";

interface CategoryOptionType {
    inputValue?: string;
    displayName: string;
}

const filter = createFilterOptions<CategoryOptionType>();

// Constants
const HTML_FORM_ID = "rec-form";
const PERIOD_FOR_RECENT_ADD_DETECTION = 30; // in seconds

function App() {
    // states
    const [category, setCategory] = useState<CategoryOptionType | null>(null);
    const [subCatArr, setSubCatArr] = useState<CategoryOptionType[] | null>(null); // autofill list for each category
    const [subCat, setSubCat] = useState<CategoryOptionType | null>(null); // sub category or merchant name
    const [date, setDate] = useState<Dayjs | null>(dayjs()); // date of purchase
    const [total, setTotal] = useState<string>(""); // total amount of money spent
    const [singleName, setSingleName] = useState<string>(""); // name of the single product (optional)
    const [productCount, setProductCount] = useState<string>(""); // amount of this singleName product bought (optional)
    const [unit, setUnit] = useState<string>(""); // unit for calculating the price for a single item (optional)
    const [errorMsg, setErrorMsg] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [submitStage, setSubmitStage] = useState<string>("");

    // use effect
    useEffect(() => {
        if (category) {
            let subCatTmpArr = subCategories.get(getCategoryLabel(category));
            if (subCatTmpArr && subCatTmpArr.length > 0) {
                setSubCatArr(subCatTmpArr.map((val: string) => {
                    return {displayName: val};
                }));
            } else {
                setSubCatArr(null);
            }
        } else {
            setSubCatArr(null);
            setSubCat(null);
        }
    }, [category]);

    const queryParams = new URLSearchParams(window.location.search);
    const formId = queryParams.get("formId"); // middle part of g form
    const eid1 = queryParams.get("eid1"); // for category
    const eid2 = queryParams.get("eid2"); // for subCat
    const eid3 = queryParams.get("eid3"); // for date
    const eid4 = queryParams.get("eid4"); // for total
    const eid5 = queryParams.get("eid5"); // for singleName
    const eid6 = queryParams.get("eid6"); // for productCount
    const eid7 = queryParams.get("eid7"); // for unit
    const sheetId = queryParams.get("sheetId"); // for public sheet to ensure uniqueness

    // handle missing params case
    if (formId === null || eid1 === null || eid2 === null || eid3 === null ||
        eid4 === null || eid5 === null || eid6 === null || eid7 === null || sheetId === null) {
        return (
            <div className="app-container">
                <h1>Missing params, please fill in the search params</h1>
                <h1>url search params不全，请在url内填入</h1>
            </div>
        );
    }

    const handleCategoryChange = (event: any, newValue: any, setFunc: any) => {
        if (typeof newValue === 'string') {
            setFunc({
                displayName: newValue,
            });
        } else if (newValue && newValue.inputValue) {
            // Create a new value from the user input
            setFunc({
                displayName: newValue.inputValue,
            });
        } else {
            setFunc(newValue);
        }
    };

    const handleCategoryInputChange = (event: any, value: string, reason: string, setFunc: any) => {
        if (reason === "clear") {
            setFunc(null);
        } else if (value.length === 0) {
            setFunc(null);
        }
    };


    const getCategoryLabel = (option: any) => {
        if (typeof option === 'string') {
            return option;
        }
        if (option.inputValue) {
            return option.inputValue;
        }
        return option.displayName;
    };

    const handleCategoryFilter = (options: any, params: any) => {
        let filtered = filter(options, params);

        let {inputValue} = params;
        // Suggest the creation of a new value
        let isExisting = options.some((option: any) => inputValue === option.displayName);
        if (inputValue !== '' && !isExisting) {
            filtered.push({
                inputValue,
                displayName: `新增 "${inputValue}"`,
            });
        }
        return filtered;
    };

    const clearForm = () => {
        setCategory(null);
        setSubCat(null);
        setDate(null);
        setTotal("");
        setSingleName("");
        setProductCount("");
        setUnit("");
        setErrorMsg("");
    };

    const validateAndSubmit = async () => {
        if (category === null || subCat == null || date === null || total.trim().length === 0) {
            setErrorMsg("请填写必填项目");
            return;
        }
        if (!date.isValid()) {
            setErrorMsg("日期无效，请输入正确的日期");
            return;
        }
        // Optional values must be filled together, or not filled together
        if (!((singleName.trim().length === 0 && productCount.trim().length === 0 && unit.trim().length === 0)
            || (singleName.trim().length > 0 && productCount.trim().length > 0 && unit.trim().length > 0))) {
            setErrorMsg("可选项目必须同时填写");
            return;
        }
        setErrorMsg("");

        // Set loading state and stage
        setIsSubmitting(true);
        setSubmitStage("正在检查重复记录...");

        // Ensure uniqueness in response from sheetId
        const parser = new PublicGoogleSheetsParser(sheetId);

        try {
            setSubmitStage("正在获取数据...");
            const data = await parser.parse();
            if (data.length === 0) {
                throw new Error("Empty Sheet");
            }
            const set = new UniqueSet();
            for (let oneEntry of data) {
                delete oneEntry["时间戳记"];
                delete oneEntry["单品名称"];
                delete oneEntry["单品数量"];
                delete oneEntry["计价单位"];
                set.add(oneEntry);
            }

            // construct object from form input, and test uniqueness
            const formObj = {
                "消费类别": category.displayName,
                "子类别/商户": subCat.displayName,
                "总价": parseFloat(total),
                "日期": date.format("MM/DD/YYYY"),
            };

            if (set.has(formObj)) { // have a confirm window for duplicate
                // eslint-disable-next-line no-restricted-globals
                if (confirm("重复记录已经找到，是否仍要提交?\nDuplicate info found, still want to submit?")) {
                    await postForm(parser, formObj);
                } else {
                    setIsSubmitting(false);
                    setSubmitStage("");
                }
            } else {
                await postForm(parser, formObj);
            }
        } catch (error) {
            setIsSubmitting(false);
            setSubmitStage("");
            setErrorMsg(`第一阶段获取数据失败: ${error}`);
        }
    };

    const postForm = async (parser: PublicGoogleSheetsParser, formObj: any) => {
        try {
            setSubmitStage("正在提交表单...");
            const formData = new FormData(document.getElementById(HTML_FORM_ID) as HTMLFormElement);
            await fetch(`https://docs.google.com/forms/d/e/${formId}/formResponse`, {
                method: "POST",
                body: formData
            });
        } catch (error) {
            // seems like having CORS error but can still post into form
            // fetch sheet to see whether we have a recent data match
            setSubmitStage("正在验证提交结果...");
            parser.parse().then((data) => {
                if (data.some((oneEntry) => {
                    const dateParts = oneEntry["时间戳记"].match(/\d+/g); // Extract all numbers from the string
                    const dateObject = new Date(
                        dateParts[0],  // year
                        dateParts[1],  // month (0-based, so no need to adjust)
                        dateParts[2],  // day
                        dateParts[3],  // hours
                        dateParts[4],  // minutes
                        dateParts[5]   // seconds
                    );
                    return (new Date().getTime() - dateObject.getTime()
                            <= PERIOD_FOR_RECENT_ADD_DETECTION * 1000)
                        && (oneEntry["消费类别"] === formObj["消费类别"])
                        && (oneEntry["子类别/商户"] === formObj["子类别/商户"])
                        && (oneEntry["总价"] === formObj["总价"])
                        && (oneEntry["日期"] === formObj["日期"]);
                })) {
                    alert("Form submitted successfully!");
                } else {
                    setErrorMsg("表单提交验证失败，可能提交未成功");
                }
            }).catch((validationError) => {
                setErrorMsg(`第二阶段验证失败: ${validationError}`);
            }).finally(() => {
                setIsSubmitting(false);
                setSubmitStage("");
            });
        }
    };

    return (
        <div className="app-container">
            <form
                id={HTML_FORM_ID}
                action={`https://docs.google.com/forms/d/e/${formId}/formResponse`}
            >
                <Autocomplete
                    value={category}
                    options={categories}
                    selectOnFocus
                    clearOnBlur
                    handleHomeEndKeys
                    freeSolo
                    onChange={(event, newValue) => {
                        handleCategoryChange(event, newValue, setCategory);
                    }}
                    onInputChange={(event, value, reason) => {
                        handleCategoryInputChange(event, value, reason, setCategory);
                    }}
                    getOptionLabel={getCategoryLabel}
                    filterOptions={handleCategoryFilter}
                    renderOption={(props, option) => <li {...props}>{option.displayName}</li>}
                    renderInput={
                        (params) =>
                            (<TextField {...params}
                                        required
                                        label="消费类别"
                                        name={`entry.${eid1}`}
                                        onKeyPress={(e) => {
                                            e.key === 'Enter' && e.preventDefault();
                                        }}
                            />)
                    }
                />
                <Autocomplete
                    value={subCat}
                    options={subCatArr ? subCatArr : []}
                    selectOnFocus
                    clearOnBlur
                    handleHomeEndKeys
                    freeSolo
                    onChange={(event, newValue) => {
                        handleCategoryChange(event, newValue, setSubCat);
                    }}
                    onInputChange={(event, value, reason) => {
                        handleCategoryInputChange(event, value, reason, setSubCat);
                    }}
                    getOptionLabel={getCategoryLabel}
                    filterOptions={handleCategoryFilter}
                    renderOption={(props, option) => <li {...props}>{option.displayName}</li>}
                    renderInput={
                        (params) =>
                            (<TextField {...params}
                                        required
                                        label="子类别/商户"
                                        name={`entry.${eid2}`}
                                        onKeyPress={(e) => {
                                            e.key === 'Enter' && e.preventDefault();
                                        }}
                                        sx={{marginTop: "1em"}}
                            />)
                    }
                />
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en">
                    <DatePicker
                        label="日期 *"
                        value={date}
                        views={['year', 'month', 'day']}
                        slotProps={{textField: {name: `entry.${eid3}`}}}
                        onChange={(newValue) => setDate(newValue)}
                        sx={{marginTop: "1em", width: "100%"}}
                    />
                </LocalizationProvider>
                <TextField
                    label="总价"
                    value={total}
                    required
                    name={`entry.${eid4}`}
                    sx={{marginTop: "1em"}}
                    fullWidth
                    InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        type: 'number',
                    }}
                    onChange={(event) => setTotal(event.target.value)}
                />
                <TextField
                    label="单品名称 (可选)"
                    value={singleName}
                    name={`entry.${eid5}`}
                    sx={{marginTop: "1em"}}
                    fullWidth
                    onChange={(event) => setSingleName(event.target.value)}
                />
                <TextField
                    label="单品数量 (可选)"
                    value={productCount}
                    name={`entry.${eid6}`}
                    sx={{marginTop: "1em", width: "45%"}}
                    InputProps={{
                        type: 'number',
                    }}
                    onChange={(event) => setProductCount(event.target.value)}
                />
                <FormControl sx={{float: "right", marginTop: "1em", width: "50%"}}>
                    <InputLabel>计价单位 (可选)</InputLabel>
                    <Select
                        label="计价单位 (可选)"
                        value={unit}
                        inputProps={{name: `entry.${eid7}`}}
                        onChange={(event) => setUnit(event.target.value)}
                    >
                        <MenuItem value="">--空--</MenuItem>
                        <MenuItem value="lb">lb</MenuItem>
                        <MenuItem value="ea">ea</MenuItem>
                        <MenuItem value="gal">gal</MenuItem>
                    </Select>
                </FormControl>

                <Button color="warning" variant="outlined" size="large"
                        sx={{marginTop: "1em"}}
                        onClick={clearForm}
                        disabled={isSubmitting}>
                    清空
                </Button>
                <Button color="primary" variant="outlined" size="large"
                        sx={{float: "right", marginTop: "1em"}}
                        onClick={validateAndSubmit}
                        disabled={isSubmitting}>
                    {isSubmitting ? "提交中..." : "提交"}
                </Button>
            </form>
            {isSubmitting && (
                <h2 style={{color: "blue"}}>{submitStage}</h2>
            )}
            <h1 style={{color: "red"}}>{errorMsg}</h1>
        </div>
    );
}

export default App;

import * as React from "react";

import axios from "axios";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Radio,
  TextField,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import BackupIcon from "@mui/icons-material/Backup";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";

import apiConfig from "../../config/apiConfig";
import { PrintQuoteFile } from "./PrintQuoteFile";

const schema = yup
  .object({
    firstname: yup.string().required("First name is required"),
    lastname: yup.string().required("Last name is required"),
    street: yup.string().required("Street is required"),
    city_: yup.string().required("City is required"),
    state_ppp: yup
      .string()
      .length(2, "State must be in short the form; MN")
      .required("State is required"),
    zipcode: yup
      .string()
      .length(5, "Zipcode must be 5 digits")
      .matches(/^\d+$/, "Zipcode must be a number")
      .required("Zipcode is required"),
  })
  .required();

export const PrintQuote = () => {
  console.log("*** reloaded ***");

  const [step, setStep] = React.useState(2);
  const [subtotal, setSubtotal] = React.useState(0);

  const [rates, setRates] = React.useState([]);
  const [sessionId, setSessionId] = React.useState(null);
  const [selectedRateId, setSelectedRateId] = React.useState();

  const [quotes, setQuotes] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    watch,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  const firstname = watch("firstname");
  const lastname = watch("lastname");
  const street = watch("street");
  const city = watch("city_");
  const state = watch("state");
  const zipcode = watch("zipcode");

  React.useEffect(() => {
    const subtotal = quotes.reduce((acc, quote) => {
      return acc + (quote?.priceTotal ?? 0);
    }, 0);

    setSubtotal(subtotal);
  }, [quotes]);

  const postRequest = async (url, formData) => {
    const unknownError = (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Typography variant="body" component="div" sx={{ fontSize: "0.75rem" }}>
          We couldn't get an estimate for this model. Please try again.
        </Typography>

        <Typography variant="body" component="div" sx={{ fontSize: "0.75rem" }}>
          If the issue persists, please reachout to us.
        </Typography>
      </Box>
    );

    let result = { data: null, error: null };

    try {
      const response = await axios.post(url, formData);

      if (response.status === 200) {
        const data = await response.data;
        result.data = data;
      } else {
        result.error = unknownError;
      }
    } catch (err) {
      console.log(err);

      switch (err?.response?.status) {
        case 400:
          result.error = err?.response?.data;
          break;

        default:
          result.error = unknownError;
      }
    }

    return result;
  };

  const getEstimate = async (quantity, material, file) => {
    const formData = new FormData();
    formData.append("quantity", quantity);
    formData.append("material", material);
    formData.append("file", file);

    const url = `${apiConfig.api.baseUrl}/v1/estimate`;
    const result = await postRequest(url, formData);

    return result;
  };

  const getShippingRates = async ({
    company,
    firstname,
    lastname,
    street,
    city,
    state,
    zipcode,
  }) => {
    const formData = new FormData();
    formData.append("company", company);
    formData.append("firstname", firstname);
    formData.append("lastname", lastname);
    formData.append("street", street);
    formData.append("city", city);
    formData.append("state", state);
    formData.append("zipcode", zipcode);

    for (const quote of quotes) {
      formData.append("quantity", quote.quantity);
      formData.append("material", quote.material);
      formData.append("color", quote.color);
      formData.append("file", quote.file);
    }

    const url = `${apiConfig.api.baseUrl}/v1/checkout/shipping/rate`;

    const result = await postRequest(url, formData);

    const sessionId = result?.data?.session_id;
    const rates = result?.data?.shipping_rates ?? [];

    setSessionId(sessionId);
    setRates(rates);
    setStep(3);
  };

  const createSession = async () => {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("session_id", sessionId);
      formData.append("selected_shipping_rate", selectedRateId);

      const url = `${apiConfig.api.baseUrl}/v1/checkout`;
      const response = await axios.post(url, formData);

      window.location.href = await response.data.checkout_link;
    } catch (err) {
      console.log(err);
    }

    setIsLoading(false);
  };

  const addQuote = async (file) => {
    setIsLoading(true);

    if (file !== null && file.length === 1) {
      const estimate = await getEstimate(1, "PLA", file[0]);

      const newQuote = {
        error: estimate?.error,
        quantity: 1,
        material: "PLA",
        color: "WHITE",
        file: file[0],
        priceEach: estimate?.data?.price_each,
        priceTotal: estimate?.data?.price_total,
        unit: "mm",
        width: estimate?.data?.width,
        length: estimate?.data?.width,
        height: estimate?.data?.width,
      };

      setQuotes([...quotes, newQuote]);
    }

    setIsLoading(false);
  };

  const updateQuote = async (id, updatedQuote) => {
    const newQuotes = [...quotes];

    if (updatedQuote === null) {
      newQuotes.splice(id, 1);
    } else {
      const estimate = await getEstimate(
        updatedQuote.quantity,
        updatedQuote.material,
        updatedQuote.file
      );

      newQuotes[id] = {
        ...updatedQuote,
        error: estimate?.error,
        priceEach: estimate?.data?.price_each,
        priceTotal: estimate?.data?.price_total,
        unit: "mm",
        width: estimate?.data?.width,
        length: estimate?.data?.length,
        height: estimate?.data?.height,
      };
    }

    setQuotes(newQuotes);
  };

  const areQuotesValidForCheckout = () => {
    return quotes?.filter((quote) => !quote.error)?.length > 0;
  };

  const ratesControlProps = (object_id) => ({
    checked: selectedRateId === object_id,
    onChange: (event) => setSelectedRateId(event.target.value),
    value: object_id,
    name: "shipping-rate-radio-button",
  });

  const getRateAmount = () => {
    const rate = rates.find((rate) => rate.object_id === selectedRateId);

    if (rate && step === 3) {
      return `$${rate.amount?.toFixed(2)}`;
    } else {
      return "Calculated later";
    }
  };

  const getTotal = () => {
    const rate = rates.find((rate) => rate.object_id === selectedRateId);

    let total = subtotal;

    if (step === 3 && rate) {
      total += rate.amount;
    }

    return total.toFixed(2);
  };

  const Panel = (props) => {
    const { children, value, index, ...other } = props;

    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`full-width-tabpanel-${index}`}
        aria-labelledby={`full-width-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box>
            <Box>{children}</Box>
          </Box>
        )}
      </div>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 0 }}>
      {/* Step 1: Add design files */}

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column-reverse", md: "row" },
        }}
      >
        <Box sx={{ py: 6, px: { xs: 0, md: 2 }, flex: 2 }}>
          <Panel index={1} value={step}>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography
                variant="h5"
                component="div"
                sx={{
                  fontSize: { xs: "1.4rem", md: "2.0rem" },
                  fontWeight: "bold",
                }}
              >
                Upload Design Files to Get Started
              </Typography>

              <Typography
                variant="body2"
                component="div"
                sx={{
                  mt: 1,
                  mb: 2,
                  color: "text.secondary",
                  fontStyle: "italic",
                }}
              >
                Please reachout to us if you have model files that is not
                currently supported.
              </Typography>
            </Box>

            <Box>
              <Box
                sx={{
                  mb: 2,
                  px: 6,
                  py: 2,
                  border: "1px dashed #676e8b78",
                  borderRadius: "5px",
                  bgcolor: "#0b076e0a",
                }}
              >
                <Typography
                  component="div"
                  variant="body1"
                  sx={{ textAlign: "center" }}
                >
                  Upload design files get pricing
                </Typography>

                {/* Files supported */}
                <Typography
                  variant="body2"
                  component="div"
                  sx={{ pt: 0.5, color: "#566573", textAlign: "center" }}
                >
                  STL | OBJ | files
                </Typography>

                {/* Quote button */}
                <Box sx={{ py: 1, display: "flex", justifyContent: "center" }}>
                  <Button
                    variant="contained"
                    component="label"
                    startIcon={<BackupIcon sx={{ mr: 0.5 }} />}
                    disabled={isLoading}
                    sx={{
                      py: 1.5,
                      px: 3,
                      bgcolor: "icon.primary",
                      textTransform: "none",
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  >
                    {isLoading ? (
                      <>
                        Uploading File
                        <CircularProgress
                          size={30}
                          sx={{ ml: 2, color: "white" }}
                        />
                      </>
                    ) : (
                      "Upload Design File"
                    )}

                    <input
                      type="file"
                      hidden
                      onClick={(e) => (e.target.value = null)}
                      onChange={(e) => addQuote(e.target.files)}
                    />
                  </Button>
                </Box>

                {/* Security info */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    color: "#ABB2B9",
                  }}
                >
                  <LockIcon sx={{ mr: 1, fontSize: "1.1rem" }} />

                  <Typography
                    variant="body2"
                    component="div"
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    All uploads are secure and confidential.
                  </Typography>
                </Box>
              </Box>

              {quotes.map((quote, index) => (
                <Box key={`quote_${index}`} sx={{ my: 0.5 }}>
                  <PrintQuoteFile
                    id={index}
                    quote={quote}
                    updateQuote={updateQuote}
                  />
                </Box>
              ))}
            </Box>

            <Box sx={{ mt: 1, display: "flex", justifyContent: "end" }}>
              <Button
                variant="contained"
                onClick={() => setStep(2)}
                disabled={!areQuotesValidForCheckout()}
                sx={{
                  mt: 2,
                  px: 5,
                  py: 1.5,
                  bgcolor: "icon.primary",
                  textTransform: "none",
                  textAlign: "center",
                }}
              >
                Continue to checkout
              </Button>
            </Box>
          </Panel>

          {/* Step 2: Shipping */}

          <Panel value={step} index={2}>
            <Typography
              variant="h5"
              component="div"
              sx={{ mb: 3, fontSize: "1.4rem" }}
            >
              Shipping Information
            </Typography>

            <FormControl sx={{ display: "flex", flexDirection: "column" }}>
              <TextField
                id="company"
                label="Company"
                variant="outlined"
                margin="dense"
                size="small"
                error={!!errors.company?.message}
                helperText={errors.company?.message}
                {...register("company")}
                sx={{ mt: 0 }}
              />

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <TextField
                  fullWidth
                  id="firstname"
                  label="First name *"
                  variant="outlined"
                  margin="dense"
                  size="small"
                  error={!!errors.firstname?.message}
                  helperText={errors.firstname?.message}
                  {...register("firstname")}
                  sx={{ mr: 2 }}
                />

                <TextField
                  fullWidth
                  id="lastname"
                  label="Last name *"
                  variant="outlined"
                  margin="dense"
                  size="small"
                  error={!!errors.lastname?.message}
                  helperText={errors.lastname?.message}
                  {...register("lastname")}
                />
              </Box>

              <TextField
                id="street"
                label="Street *"
                variant="outlined"
                margin="dense"
                size="small"
                error={!!errors.street?.message}
                helperText={errors.street?.message}
                {...register("street")}
              />

              <TextField
                id="city_"
                label="City *"
                variant="outlined"
                margin="dense"
                size="small"
                error={!!errors.city_?.message}
                helperText={errors.city?.message}
                {...register("city_")}
              />

              <TextField
                id="state"
                label="State *"
                variant="outlined"
                margin="dense"
                size="small"
                error={!!errors.state?.message}
                helperText={errors.state?.message}
                {...register("state")}
              />

              <TextField
                id="zipcode"
                label="Zipcode *"
                variant="outlined"
                margin="dense"
                size="small"
                error={!!errors.zipcode?.message}
                helperText={errors.zipcode?.message}
                {...register("zipcode")}
              />

              <Box
                sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}
              >
                <Typography
                  variant="body2"
                  component="div"
                  onClick={() => setStep(1)}
                  sx={{
                    color: "text.secondary",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <ArrowBackIosIcon sx={{ fontSize: "0.9rem" }} />
                  Back to quotes
                </Typography>

                <Button
                  variant="contained"
                  onClick={handleSubmit(getShippingRates)}
                  disabled={quotes?.length === 0}
                  sx={{
                    py: 1,
                    textTransform: "none",
                  }}
                >
                  Proceed to shipping
                </Button>
              </Box>
            </FormControl>
          </Panel>

          {/* Step 3: Summary and Checkout */}

          <Panel value={step} index={3}>
            <Box
              sx={{
                p: 2,
                display: "flex",

                alignItems: "center",
                borderRadius: "5px",
                border: "1px solid lightgray",
              }}
            >
              <Typography
                variant="body2"
                component="div"
                sx={{ color: "text.secondary" }}
              >
                Shipping to
              </Typography>

              <Box sx={{ ml: 4, flex: 1 }}>
                <Typography variant="body2" component="div" sx={{}}>
                  {`${firstname} ${lastname}`}
                </Typography>

                <Typography variant="body2" component="div" sx={{}}>
                  {`${street}, ${city}, ${state}, ${zipcode}`}
                </Typography>
              </Box>

              <Typography
                variant="body2"
                component="div"
                onClick={() => setStep(2)}
                sx={{ color: "text.secondary", cursor: "pointer" }}
              >
                Edit
              </Typography>
            </Box>

            <Typography
              variant="h5"
              component="div"
              sx={{ mt: 6, mb: 2, fontSize: "1.4rem" }}
            >
              Shipping Method
            </Typography>

            {rates.map((rate) => (
              <Box
                onClick={() => setSelectedRateId(rate.object_id)}
                sx={{
                  p: 1,
                  my: 1,
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "5px",
                  border: "1px solid lightgray",
                  cursor: "pointer",
                }}
              >
                <Radio {...ratesControlProps(rate.object_id)} />

                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" component="div">
                    {`${rate.provider} ${rate.service_level}`}
                  </Typography>

                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ color: "text.secondary" }}
                  >
                    {rate.delivery_estimate_min} business days
                  </Typography>
                </Box>

                <Typography variant="body2" component="div" sx={{ pr: 2 }}>
                  ${rate.amount.toFixed(2)}
                </Typography>
              </Box>
            ))}

            <Box
              sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}
            >
              <Typography
                variant="body2"
                component="div"
                onClick={() => setStep(2)}
                sx={{
                  color: "text.secondary",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ArrowBackIosIcon sx={{ fontSize: "0.9rem" }} />
                Back to shipping information
              </Typography>

              <Button
                variant="contained"
                onClick={handleSubmit(createSession)}
                disabled={quotes?.length === 0}
                sx={{
                  py: 1,
                  textTransform: "none",
                }}
              >
                Proceed to payment
              </Button>
            </Box>
          </Panel>
        </Box>

        {/* Price Summary */}

        <Box
          sx={{
            p: 2,
            mt: { xs: 2, md: 0 },
            flex: 1,
            backgroundColor: "#fafafa",
            borderLeft: { xs: "", md: "1px solid lightgray" },
          }}
        >
          {/* xs */}
          <Accordion
            square
            elevation={0}
            disableGutters={true}
            sx={{
              display: { xs: "block", md: "none" },
              backgroundColor: "#fafafa",
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <ShoppingCartIcon sx={{ mr: 1 }} />

              <Typography
                variant="body1"
                component="div"
                sx={{ flex: 1, color: "text.secondary" }}
              >
                Order summary
              </Typography>

              <Typography variant="body1" component="div" sx={{}}>
                ${getTotal()}
              </Typography>
            </AccordionSummary>

            <AccordionDetails sx={{}}>
              {quotes.map((quote, index) =>
                quote.priceTotal ? (
                  <Box
                    key={`quote_${index}`}
                    sx={{ mb: 0.5, display: "flex", color: "text.secondary" }}
                  >
                    <Typography
                      variant="body2"
                      component="div"
                      sx={{ flex: "1" }}
                    >
                      {quote.file.name}
                    </Typography>

                    <Typography
                      variant="body2"
                      component="div"
                      sx={{ margin: "auto" }}
                    >
                      ${quote?.priceTotal?.toFixed(2)}
                    </Typography>
                  </Box>
                ) : (
                  <></>
                )
              )}

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 0.5, display: "flex", color: "text.secondary" }}>
                <Typography variant="body2" component="div" sx={{ flex: "1" }}>
                  Subtotal
                </Typography>

                <Typography
                  variant="body2"
                  component="div"
                  sx={{ margin: "auto" }}
                >
                  ${subtotal.toFixed(2)}
                </Typography>
              </Box>

              <Box sx={{ mb: 0.5, display: "flex", color: "text.secondary" }}>
                <Typography variant="body2" component="div" sx={{ flex: "1" }}>
                  Shipping
                </Typography>

                <Typography
                  variant="body2"
                  component="div"
                  sx={{ margin: "auto" }}
                >
                  {getRateAmount()}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 0.5, display: "flex" }}>
                <Typography variant="body1" component="div" sx={{ flex: "1" }}>
                  Total
                </Typography>

                <Typography
                  variant="body2"
                  component="div"
                  sx={{ margin: "auto", fontSize: "1.5rem" }}
                >
                  ${getTotal()}
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* md */}
          <Box sx={{ py: 6, display: { xs: "none", md: "block" } }}>
            {quotes.map((quote, index) =>
              quote.priceTotal ? (
                <Box
                  key={`quote_${index}`}
                  sx={{ mb: 0.5, display: "flex", color: "text.secondary" }}
                >
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ flex: "1" }}
                  >
                    {quote.file.name}
                  </Typography>

                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ margin: "auto" }}
                  >
                    ${quote?.priceTotal?.toFixed(2)}
                  </Typography>
                </Box>
              ) : (
                <></>
              )
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 0.5, display: "flex", color: "text.secondary" }}>
              <Typography variant="body2" component="div" sx={{ flex: "1" }}>
                Subtotal
              </Typography>

              <Typography
                variant="body2"
                component="div"
                sx={{ margin: "auto" }}
              >
                ${subtotal.toFixed(2)}
              </Typography>
            </Box>

            <Box sx={{ mb: 0.5, display: "flex", color: "text.secondary" }}>
              <Typography variant="body2" component="div" sx={{ flex: "1" }}>
                Shipping
              </Typography>

              <Typography
                variant="body2"
                component="div"
                sx={{ margin: "auto" }}
              >
                {getRateAmount()}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 0.5, display: "flex" }}>
              <Typography variant="body1" component="div" sx={{ flex: "1" }}>
                Total
              </Typography>

              <Typography
                variant="body2"
                component="div"
                sx={{ margin: "auto", fontSize: "1.5rem" }}
              >
                ${getTotal()}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

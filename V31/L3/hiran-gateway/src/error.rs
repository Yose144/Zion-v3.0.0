//! OpenAI-shaped API errors.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub err_type: &'static str,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, err_type: &'static str, msg: impl Into<String>) -> Self {
        Self {
            status,
            err_type,
            message: msg.into(),
        }
    }
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "authentication_error", msg)
    }
    pub fn rate_limited(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::TOO_MANY_REQUESTS, "rate_limit", msg)
    }
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid_request", msg)
    }
    pub fn overloaded(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::SERVICE_UNAVAILABLE, "overloaded", msg)
    }
    pub fn server(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "server_error", msg)
    }
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "invalid_request", msg)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({
                "error": {
                    "message": self.message,
                    "type": self.err_type,
                    "code": self.status.as_u16(),
                }
            })),
        )
            .into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

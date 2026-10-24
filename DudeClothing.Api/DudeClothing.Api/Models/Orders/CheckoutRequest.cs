
using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models.Orders;

public class CheckoutRequest
{
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [Phone]
    [StringLength(30)]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    [StringLength(200, MinimumLength = 3)]
    public string AddressLine1 { get; set; } = string.Empty;

    [StringLength(200)]
    public string? AddressLine2 { get; set; }

    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string City { get; set; } = string.Empty;

    [StringLength(20)]
    public string? PostalCode { get; set; }

    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string Country { get; set; } = string.Empty;
}

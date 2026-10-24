
using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models.Orders;

public class UpdateOrderStatusRequest
{
    [Required]
    public string OrderStatus { get; set; } = string.Empty;
}

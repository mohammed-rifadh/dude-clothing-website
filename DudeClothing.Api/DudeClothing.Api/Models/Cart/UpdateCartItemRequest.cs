
using System.ComponentModel.DataAnnotations;

namespace DudeClothing.Api.Models.Cart;

public class UpdateCartItemRequest
{
    [Range(1, 100)]
    public int Quantity { get; set; }
}
